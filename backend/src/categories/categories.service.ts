import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  Category,
  CategoryDocument,
  CategoryAttribute,
} from './schemas/category.schema.js';
import {
  AttributeDefinition,
  AttributeDefinitionDocument,
} from './schemas/attribute-definition.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import {
  CACHE_KEY_CATEGORY_TREE,
  CACHE_TTL_CATEGORY_TREE,
} from '../common/constants/index.js';
import { ERROR } from '../common/constants/error-messages.js';

export interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId: string | null;
  level: number;
  isActive: boolean;
  hasBrands: boolean;
  sortOrder: number;
  attributes: any[];
  features: string[];
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(AttributeDefinition.name)
    private readonly attrDefModel: Model<AttributeDefinitionDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const cached = await this.redis.get(CACHE_KEY_CATEGORY_TREE);
    if (cached) {
      return JSON.parse(cached) as CategoryTreeNode[];
    }

    const categories = await this.categoryModel
      .find({})
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();

    const tree = this.buildTree(categories);
    await this.redis.set(
      CACHE_KEY_CATEGORY_TREE,
      JSON.stringify(tree),
      'EX',
      CACHE_TTL_CATEGORY_TREE,
    );
    return tree;
  }

  async findById(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(ERROR.CATEGORY_NOT_FOUND);
    }
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(ERROR.CATEGORY_NOT_FOUND);
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      if (parent.level >= 3) {
        throw new BadRequestException(
          'Maximum category nesting depth is 3 levels',
        );
      }
      level = parent.level + 1;
    }

    const slug = dto.slug || this.generateSlug(dto.name);

    const category = new this.categoryModel({
      name: dto.name,
      slug,
      icon: dto.icon || '',
      parentId: dto.parentId || null,
      level,
      isActive: dto.isActive ?? true,
      hasBrands: dto.hasBrands ?? false,
      sortOrder: dto.sortOrder ?? 0,
      attributes: [],
      features: [],
    });

    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const category = await this.findById(id);
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.slug !== undefined) category.slug = dto.slug;
    if (dto.icon !== undefined) (category as any).icon = dto.icon;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    if (dto.hasBrands !== undefined)
      (category as any).hasBrands = dto.hasBrands;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    const children = await this.categoryModel
      .find({ parentId: category._id })
      .exec();
    if (children.length > 0) {
      throw new BadRequestException(
        'Cannot delete a category that has subcategories',
      );
    }
    await this.categoryModel.deleteOne({ _id: category._id }).exec();
    await this.invalidateCache();
  }

  async updateAttributes(
    id: string,
    attributes: CategoryAttribute[],
  ): Promise<CategoryDocument> {
    const category = await this.findById(id);

    // Reject attributes whose keys already exist in any parent category
    if (category.parentId) {
      const chain = await this.getCategoryChain(category.parentId.toString());
      const parentKeys = new Set<string>();
      for (const cat of chain) {
        for (const attr of cat.attributes || []) {
          parentKeys.add(attr.key);
        }
      }
      const duplicates = attributes
        .filter((a) => parentKeys.has(a.key))
        .map((a) => a.key);
      if (duplicates.length > 0) {
        throw new BadRequestException(
          `Attributes already defined in a parent category: ${duplicates.join(', ')}`,
        );
      }
    }

    category.attributes = attributes;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  /**
   * Assign attributes from the global registry to a category.
   * Resolves definition IDs, checks for parent conflicts, and stores denormalized data.
   */
  async assignAttributes(
    id: string,
    assignments: Array<{
      definitionId: string;
      required?: boolean;
      options?: string[];
      unit?: string;
      rangeMin?: number;
      rangeMax?: number;
      allowOther?: boolean;
    }>,
  ): Promise<CategoryDocument> {
    const category = await this.findById(id);

    // Resolve definitions
    const defIds = assignments.map((a) => a.definitionId);
    const definitions = await this.attrDefModel
      .find({ _id: { $in: defIds } })
      .lean()
      .exec();
    const defMap = new Map(definitions.map((d) => [d._id.toString(), d]));

    const missing = defIds.filter((did) => !defMap.has(did));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Attribute definitions not found: ${missing.join(', ')}`,
      );
    }

    // Build attributes: definition provides the base, assignment can override values
    const attributes: CategoryAttribute[] = assignments.map((a) => {
      const def = defMap.get(a.definitionId)!;
      return {
        name: def.name,
        key: def.key,
        type: def.type,
        options: a.options ?? def.options ?? [],
        required: a.required ?? false,
        unit: a.unit ?? def.unit,
        rangeMin: a.rangeMin ?? def.rangeMin,
        rangeMax: a.rangeMax ?? def.rangeMax,
        allowOther: a.allowOther ?? def.allowOther ?? false,
      } as CategoryAttribute;
    });

    // Check for parent conflicts
    if (category.parentId) {
      const chain = await this.getCategoryChain(category.parentId.toString());
      const parentKeys = new Set<string>();
      for (const cat of chain) {
        for (const attr of cat.attributes || []) {
          parentKeys.add(attr.key);
        }
      }
      const duplicates = attributes
        .filter((a) => parentKeys.has(a.key))
        .map((a) => a.key);
      if (duplicates.length > 0) {
        throw new BadRequestException(
          `Attributes already defined in a parent category: ${duplicates.join(', ')}`,
        );
      }
    }

    category.attributes = attributes;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async updateFeatures(
    id: string,
    features: string[],
  ): Promise<CategoryDocument> {
    const category = await this.findById(id);
    category.features = features;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async invalidateCache(): Promise<void> {
    await this.redis.del(CACHE_KEY_CATEGORY_TREE);
  }

  /**
   * Get all attributes for a category including inherited ones from parent categories.
   * Child attributes override parent attributes with the same key.
   */
  async getInheritedAttributes(
    categoryId: string,
  ): Promise<CategoryAttribute[]> {
    const chain = await this.getCategoryChain(categoryId);
    const merged = new Map<string, CategoryAttribute>();
    for (const cat of chain) {
      for (const attr of cat.attributes || []) {
        merged.set(attr.key, attr);
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Get all features for a category including inherited ones from parent categories.
   * Features are merged (union) from root to leaf.
   */
  async getInheritedFeatures(categoryId: string): Promise<string[]> {
    const chain = await this.getCategoryChain(categoryId);
    const merged = new Set<string>();
    for (const cat of chain) {
      for (const feature of cat.features || []) {
        merged.add(feature);
      }
    }
    return Array.from(merged);
  }

  private async getCategoryChain(
    categoryId: string,
  ): Promise<CategoryDocument[]> {
    const chain: CategoryDocument[] = [];
    let current = await this.findById(categoryId);
    chain.unshift(current);
    while (current.parentId) {
      current = await this.findById(current.parentId.toString());
      chain.unshift(current);
    }
    return chain;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private buildTree(
    categories: Array<Record<string, any>>,
  ): CategoryTreeNode[] {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const cat of categories) {
      const node: CategoryTreeNode = {
        _id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || '',
        parentId: cat.parentId ? cat.parentId.toString() : null,
        level: cat.level,
        isActive: cat.isActive,
        hasBrands: cat.hasBrands ?? false,
        sortOrder: cat.sortOrder,
        attributes: cat.attributes || [],
        features: cat.features || [],
        children: [],
      };
      map.set(node._id, node);
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
