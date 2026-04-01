import { AdPackageType } from '../schemas/ad-package.schema.js';
import { CategoryPricingDto } from './create-package.dto.js';
export declare class UpdatePackageDto {
    name?: string;
    type?: AdPackageType;
    duration?: number;
    quantity?: number;
    defaultPrice?: number;
    categoryPricing?: CategoryPricingDto[];
    isActive?: boolean;
}
