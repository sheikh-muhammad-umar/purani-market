import { ListingCondition } from '../schemas/product-listing.schema.js';
import { CreateListingPriceDto, CreateListingImageDto, CreateListingVideoDto, CreateListingLocationDto, CreateListingContactInfoDto } from './create-listing.dto.js';
export declare class UpdateListingDto {
    title?: string;
    description?: string;
    price?: CreateListingPriceDto;
    condition?: ListingCondition;
    categoryAttributes?: Record<string, any>;
    images?: CreateListingImageDto[];
    video?: CreateListingVideoDto;
    location?: CreateListingLocationDto;
    contactInfo?: CreateListingContactInfoDto;
}
