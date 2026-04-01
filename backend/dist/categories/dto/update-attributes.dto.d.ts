import { AttributeType } from '../schemas/category.schema.js';
export declare class CategoryAttributeDto {
    name: string;
    key: string;
    type: AttributeType;
    options?: string[];
    required?: boolean;
    unit?: string;
}
export declare class UpdateAttributesDto {
    attributes: CategoryAttributeDto[];
}
