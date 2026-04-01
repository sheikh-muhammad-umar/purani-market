import { ListingsService } from './listings.service.js';
import { MediaService } from './media.service.js';
import { PackagesService } from '../packages/packages.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UploadMediaDto } from './dto/upload-media.dto.js';
export declare class ListingsController {
    private readonly listingsService;
    private readonly mediaService;
    private readonly packagesService;
    constructor(listingsService: ListingsService, mediaService: MediaService, packagesService: PackagesService);
    getListings(page?: string, limit?: string, sort?: string, order?: string, mine?: string, userId?: string): Promise<import("./listings.service.js").PaginatedListings>;
    getListingById(id: string): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    createListing(sellerId: string, dto: CreateListingDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    updateListing(id: string, sellerId: string, dto: UpdateListingDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    updateListingStatus(id: string, sellerId: string, dto: UpdateStatusDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    deleteListing(id: string, userId: string, userRole: string): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    featureListing(id: string, sellerId: string): Promise<import("mongoose").Document<unknown, {}, import("./schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/product-listing.schema.js").ProductListing & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    uploadMedia(listingId: string, sellerId: string, file: Express.Multer.File, dto: UploadMediaDto): Promise<import("./media.service.js").MediaUploadResult>;
}
