import { AdminService } from './admin.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateAdLimitDto } from './dto/update-ad-limit.dto.js';
import { RejectListingDto } from './dto/reject-listing.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    listUsers(query: ListUsersQueryDto): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    updateUserStatus(id: string, dto: UpdateUserStatusDto): Promise<{
        message: string;
        userId: import("mongoose").Types.ObjectId;
    }>;
    updateUserRole(id: string, dto: UpdateUserRoleDto): Promise<{
        message: string;
        userId: import("mongoose").Types.ObjectId;
    }>;
    updateAdLimit(id: string, dto: UpdateAdLimitDto): Promise<{
        message: string;
        userId: import("mongoose").Types.ObjectId;
        adLimit: number;
    }>;
    getPendingListings(page: number, limit: number): Promise<import("./admin.service.js").PaginatedListings>;
    approveListing(id: string): Promise<{
        message: string;
        listingId: import("mongoose").Types.ObjectId;
        status: import("../listings/schemas/product-listing.schema.js").ListingStatus;
    }>;
    rejectListing(id: string, dto: RejectListingDto): Promise<{
        message: string;
        listingId: import("mongoose").Types.ObjectId;
        status: import("../listings/schemas/product-listing.schema.js").ListingStatus;
        rejectionReason: string | undefined;
    }>;
    getAnalytics(dateFrom?: string, dateTo?: string): Promise<import("./admin.service.js").AnalyticsData>;
    exportAnalytics(dateFrom?: string, dateTo?: string): Promise<import("./admin.service.js").AnalyticsExport>;
    listPackagePurchases(query: ListPurchasesQueryDto): Promise<import("./admin.service.js").PaginatedPurchases>;
    listPayments(query: ListPaymentsQueryDto): Promise<import("./admin.service.js").PaginatedPurchases>;
    getSellerAdInfo(id: string): Promise<import("./admin.service.js").SellerAdInfo>;
}
