import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Category, CategoryDocument, CategoryAttribute, CategoryFilter } from './schemas/category.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const CACHE_KEY_TREE = 'categories:tree';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  isActive: boolean;
  sortOrder: number;
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    // Try cache first
    const cached = await this.redis.get(CACHE_KEY_TREE);
    if (cached) {
      return JSON.parse(cached) as CategoryTreeNode[];
    }

    const categories = await this.categoryModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean()
      .exec();

    const tree = this.buildTree(categories);

    // Cache the tree
    await this.redis.set(CACHE_KEY_TREE, JSON.stringify(tree), 'EX', CACHE_TTL_SECONDS);

    return tree;
  }

  async findById(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Category not found');
    }
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      if (parent.level >= 3) {
        throw new BadRequestException('Maximum category nesting depth is 3 levels');
      }
      level = parent.level + 1;
    }

    const slug = dto.slug || this.generateSlug(dto.name);

    const category = new this.categoryModel({
      name: dto.name,
      slug,
      parentId: dto.parentId || null,
      level,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      attributes: [],
      filters: [],
    });

    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const category = await this.findById(id);

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.slug !== undefined) category.slug = dto.slug;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;

    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);

    // Check for children
    const children = await this.categoryModel.find({ parentId: category._id }).exec();
    if (children.length > 0) {
      throw new BadRequestException('Cannot delete a category that has subcategories');
    }

    await this.categoryModel.deleteOne({ _id: category._id }).exec();
    await this.invalidateCache();
  }

  async updateAttributes(id: string, attributes: CategoryAttribute[]): Promise<CategoryDocument> {
    const category = await this.findById(id);
    category.attributes = attributes;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async updateFilters(id: string, filters: CategoryFilter[]): Promise<CategoryDocument> {
    const category = await this.findById(id);
    category.filters = filters;
    const saved = await category.save();
    await this.invalidateCache();
    return saved;
  }

  async invalidateCache(): Promise<void> {
    await this.redis.del(CACHE_KEY_TREE);
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

    // Create nodes
    for (const cat of categories) {
      const node: CategoryTreeNode = {
        _id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId ? cat.parentId.toString() : null,
        level: cat.level,
        isActive: cat.isActive,
        sortOrder: cat.sortOrder,
        children: [],
      };
      map.set(node._id, node);
    }

    // Build hierarchy
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
