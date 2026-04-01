import { AdPackageType } from '../schemas/ad-package.schema.js';
export declare class CategoryPricingDto {
    categoryId: string;
    price: number;
}
export declare class CreatePackageDto {
    name: string;
    type: AdPackageType;
    duration: number;
    quantity: number;
    defaultPrice: number;
    categoryPricing?: CategoryPricingDto[];
    isActive?: boolean;
}
