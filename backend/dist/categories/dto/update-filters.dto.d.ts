import { FilterType } from '../schemas/category.schema.js';
export declare class CategoryFilterDto {
    name: string;
    key: string;
    type: FilterType;
    options?: string[];
    rangeMin?: number;
    rangeMax?: number;
}
export declare class UpdateFiltersDto {
    filters: CategoryFilterDto[];
}
