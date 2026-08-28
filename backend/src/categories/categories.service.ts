import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
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
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import {
  CACHE_KEY_CATEGORY_TREE,
  CACHE_TTL_CATEGORY_TREE,
} from '../common/constants/index.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';

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

/** Consequences of deleting a category, shown to an admin before confirming. */
export interface CategoryDeleteImpact {
  categoryId: string;
  categoryName: string;
  childCount: number;
  listingCount: number;
  parentId: string | null;
  parentName: string | null;
  canDelete: boolean;
}

/** Upper bound on listings re-indexed inline after a reparent. */
const CATEGORY_REINDEX_LIMIT = 5000;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(AttributeDefinition.name)
    private readonly attrDefModel: Model<AttributeDefinitionDocument>,
    @InjectRedis() private readonly redis: Redis,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @Optional()
    @Inject(forwardRef(() => SearchSyncService))
    private readonly searchSync?: SearchSyncService,
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      if (parent.level >= 3) {
        throw new BadRequestException(PUBLIC_ERROR.CATEGORY_ACTION_FAILED);
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

  /**
   * What deleting a category would affect. Powers the admin confirmation step so
   * the operator sees the listing count and where those listings will end up
   * before committing.
   */
  async getDeleteImpact(id: string): Promise<CategoryDeleteImpact> {
    const category = await this.findById(id);
    const [childCount, listingCount] = await Promise.all([
      this.categoryModel.countDocuments({ parentId: category._id }).exec(),
      this.listingModel.countDocuments({ categoryId: category._id }).exec(),
    ]);

    let parentName: string | null = null;
    if (category.parentId) {
      const parent = await this.categoryModel
        .findById(category.parentId)
        .lean()
        .exec();
      parentName = parent?.name ?? null;
    }

    return {
      categoryId: category._id.toString(),
      categoryName: category.name,
      childCount,
      listingCount,
      parentId: category.parentId ? category.parentId.toString() : null,
      parentName,
      // A root category has nowhere to move its listings to.
      canDelete:
        childCount === 0 && (listingCount === 0 || !!category.parentId),
    };
  }

  /**
   * Deletes a category, moving any listings it still holds up to its parent.
   *
   * Previously the listings were left pointing at a category id that no longer
   * existed, so they vanished from category browsing and their `categoryPath`
   * kept a dangling ancestor. Reparenting keeps them reachable under the parent
   * instead. Root categories with listings are refused outright rather than
   * orphaning the data.
   */
  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    const children = await this.categoryModel
      .find({ parentId: category._id })
      .exec();
    if (children.length > 0) {
      throw new BadRequestException(PUBLIC_ERROR.CATEGORY_ACTION_FAILED);
    }

    const listingCount = await this.listingModel
      .countDocuments({ categoryId: category._id })
      .exec();

    if (listingCount > 0) {
      if (!category.parentId) {
        throw new BadRequestException(PUBLIC_ERROR.CATEGORY_ACTION_FAILED);
      }
      await this.reparentListings(category);
    }

    await this.categoryModel.deleteOne({ _id: category._id }).exec();
    await this.invalidateCache();
  }

  /**
   * Points every listing in `category` at its parent and rewrites
   * `categoryPath` to the parent's ancestry, then refreshes the search index.
   */
  private async reparentListings(category: CategoryDocument): Promise<void> {
    const parentId = category.parentId!;
    const chain = await this.getCategoryChain(parentId.toString());
    const parentPath = chain.map((cat) => cat._id);
    const parent = chain[chain.length - 1];

    await this.listingModel
      .updateMany(
        { categoryId: category._id },
        {
          $set: {
            categoryId: parent._id,
            categoryPath: parentPath,
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    await this.reindexListingsForCategory(parent._id);
  }

  /**
   * Re-indexes the moved listings so search reflects the new category.
   *
   * Real-time sync relies on a MongoDB change stream, which is unavailable on a
   * standalone server, so the reindex is explicit here. Failures are logged
   * rather than thrown: the reparenting has already been committed and must not
   * be rolled back by a search outage.
   */
  private async reindexListingsForCategory(
    categoryId: Types.ObjectId,
  ): Promise<void> {
    if (!this.searchSync) return;
    try {
      const listings = await this.listingModel
        .find({ categoryId })
        .limit(CATEGORY_REINDEX_LIMIT)
        .exec();
      for (const listing of listings) {
        await this.searchSync.indexListing(listing);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to reindex listings for category ${categoryId.toString()}: ${
          (err as Error).message
        }`,
      );
    }
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
        throw new BadRequestException(PUBLIC_ERROR.CATEGORY_ACTION_FAILED);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
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
        throw new BadRequestException(PUBLIC_ERROR.CATEGORY_ACTION_FAILED);
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
