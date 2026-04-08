import { Model } from 'mongoose';
import { ProductListingDocument } from './schemas/product-listing.schema.js';
import { StorageService } from './storage.service.js';
import { MediaType } from './dto/upload-media.dto.js';
export declare const ALLOWED_IMAGE_MIMETYPES: string[];
export declare const ALLOWED_VIDEO_MIMETYPES: string[];
export declare const MAX_IMAGE_SIZE: number;
export declare const MAX_VIDEO_SIZE: number;
export declare const MAX_IMAGES_PER_LISTING = 20;
export declare const MAX_VIDEOS_PER_LISTING = 1;
export interface MediaUploadResult {
    url: string;
    thumbnailUrl?: string;
    type: MediaType;
    sortOrder?: number;
}
export declare class MediaService {
    private readonly listingModel;
    private readonly storageService;
    constructor(listingModel: Model<ProductListingDocument>, storageService: StorageService);
    uploadMedia(listingId: string, sellerId: string, file: Express.Multer.File, type: MediaType, sortOrder?: number): Promise<MediaUploadResult>;
    validateFile(file: Express.Multer.File, type: MediaType): void;
    validateMediaLimits(listing: ProductListingDocument, type: MediaType): void;
    private processImageUpload;
    private processVideoUpload;
    private getListingOrThrow;
    private verifyOwnership;
}
