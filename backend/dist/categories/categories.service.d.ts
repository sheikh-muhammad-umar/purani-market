import { Model } from 'mongoose';
import Redis from 'ioredis';
import { CategoryDocument, CategoryAttribute } from './schemas/category.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
export interface CategoryTreeNode {
    _id: string;
    name: string;
    slug: string;
    parentId: string | null;
    level: number;
    isActive: boolean;
    sortOrder: number;
    attributes: any[];
    features: string[];
    children: CategoryTreeNode[];
}
export declare class CategoriesService {
    private readonly categoryModel;
    private readonly redis;
    constructor(categoryModel: Model<CategoryDocument>, redis: Redis);
    getCategoryTree(): Promise<CategoryTreeNode[]>;
    findById(id: string): Promise<CategoryDocument>;
    create(dto: CreateCategoryDto): Promise<CategoryDocument>;
    update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument>;
    delete(id: string): Promise<void>;
    updateAttributes(id: string, attributes: CategoryAttribute[]): Promise<CategoryDocument>;
    updateFeatures(id: string, features: string[]): Promise<CategoryDocument>;
    invalidateCache(): Promise<void>;
    getInheritedAttributes(categoryId: string): Promise<CategoryAttribute[]>;
    getInheritedFeatures(categoryId: string): Promise<string[]>;
    private getCategoryChain;
    private generateSlug;
    private buildTree;
}
