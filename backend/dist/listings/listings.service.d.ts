import { Model, Types } from 'mongoose';
import { ProductListingDocument } from './schemas/product-listing.schema.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { CategoryDocument } from '../categories/schemas/category.schema.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { AllowedStatusTransition } from './dto/update-status.dto.js';
import { SearchSyncService } from '../search/search-sync.service.js';
export interface PaginatedListings {
    data: ProductListingDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare class ListingsService {
    private readonly listingModel;
    private readonly userModel;
    private readonly categoryModel;
    private readonly searchSyncService;
    private readonly logger;
    constructor(listingModel: Model<ProductListingDocument>, userModel: Model<UserDocument>, categoryModel: Model<CategoryDocument>, searchSyncService: SearchSyncService);
    findAll(page?: number, limit?: number, sort?: string, order?: 'asc' | 'desc', sellerId?: string): Promise<PaginatedListings>;
    findById(id: string | Types.ObjectId): Promise<ProductListingDocument>;
    findByIdAndIncrementViews(id: string, requesterId?: string, requesterRole?: string): Promise<ProductListingDocument>;
    update(id: string, sellerId: string, dto: UpdateListingDto): Promise<ProductListingDocument>;
    updateStatus(id: string, sellerId: string, status: AllowedStatusTransition): Promise<ProductListingDocument>;
    softDelete(id: string, userId: string, userRole: string): Promise<ProductListingDocument>;
    create(sellerId: string, dto: CreateListingDto, moderationEnabled?: boolean): Promise<ProductListingDocument>;
    private syncToEs;
    private removeFromEs;
    private assertOwnership;
    private validateCategoryAttributes;
    private buildCategoryPath;
}
