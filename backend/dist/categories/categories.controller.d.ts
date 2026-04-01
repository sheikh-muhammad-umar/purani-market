import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateAttributesDto } from './dto/update-attributes.dto.js';
import { UpdateFiltersDto } from './dto/update-filters.dto.js';
export declare class CategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    getCategoryTree(): Promise<import("./categories.service.js").CategoryTreeNode[]>;
    getCategoryById(id: string): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    createCategory(dto: CreateCategoryDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    updateCategory(id: string, dto: UpdateCategoryDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    deleteCategory(id: string): Promise<void>;
    updateAttributes(id: string, dto: UpdateAttributesDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    updateFilters(id: string, dto: UpdateFiltersDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
}
