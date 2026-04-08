import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateAttributesDto } from './dto/update-attributes.dto.js';
import { UpdateFeaturesDto } from './dto/update-features.dto.js';
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
    getInheritedAttributes(id: string): Promise<{
        attributes: import("./schemas/category.schema.js").CategoryAttribute[];
        features: string[];
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
    updateFeatures(id: string, dto: UpdateFeaturesDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/category.schema.js").Category, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/category.schema.js").Category & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
}
