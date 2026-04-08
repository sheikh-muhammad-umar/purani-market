import { ListingCondition } from '../schemas/product-listing.schema.js';
export declare class CreateListingPriceDto {
    amount: number;
    currency?: string;
}
export declare class CreateListingImageDto {
    url: string;
    thumbnailUrl?: string;
    sortOrder?: number;
}
export declare class CreateListingVideoDto {
    url: string;
    thumbnailUrl?: string;
}
export declare class CreateListingLocationDto {
    coordinates?: number[];
    city?: string;
    area?: string;
}
export declare class CreateListingContactInfoDto {
    phone?: string;
    email?: string;
}
export declare class CreateListingDto {
    title: string;
    description: string;
    price: CreateListingPriceDto;
    categoryId: string;
    categoryPath?: string[];
    condition: ListingCondition;
    categoryAttributes?: Record<string, any>;
    selectedFeatures?: string[];
    images?: CreateListingImageDto[];
    video?: CreateListingVideoDto;
    location: CreateListingLocationDto;
    contactInfo?: CreateListingContactInfoDto;
    isFeatured?: boolean;
}
