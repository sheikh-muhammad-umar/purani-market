import { Model } from 'mongoose';
import { UserDocument, UserRole, UserStatus } from '../users/schemas/user.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
import { ConversationDocument } from '../messaging/schemas/conversation.schema.js';
import { ReviewDocument } from '../reviews/schemas/review.schema.js';
import { PackagePurchaseDocument } from '../packages/schemas/package-purchase.schema.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
export interface PaginatedUsers {
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface PaginatedListings {
    data: ProductListingDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface UserActivitySummary {
    listingsCount: number;
    conversationsCount: number;
    violationsCount: number;
}
export interface TimeSeriesEntry {
    date: string;
    count: number;
}
export interface CategoryAnalytics {
    categoryId: string;
    categoryName: string;
    listingCount: number;
}
export interface AnalyticsData {
    keyMetrics: {
        totalUsers: number;
        activeUsers: number;
        totalListings: number;
        totalConversations: number;
        totalPackagePurchases: number;
        totalRevenue: number;
    };
    timeSeries: {
        registrations: TimeSeriesEntry[];
        listings: TimeSeriesEntry[];
        conversations: TimeSeriesEntry[];
        purchases: TimeSeriesEntry[];
    };
    categoryAnalytics: CategoryAnalytics[];
}
export interface AnalyticsExport {
    generatedAt: string;
    dateRange: {
        from: string;
        to: string;
    };
    keyMetrics: AnalyticsData['keyMetrics'];
    timeSeries: AnalyticsData['timeSeries'];
    categoryAnalytics: CategoryAnalytics[];
}
export interface PaginatedPurchases {
    data: PackagePurchaseDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface SellerAdInfo {
    sellerId: string;
    activeAdCount: number;
    adLimit: number;
    remainingFreeSlots: number;
    activePackageSlots: number;
}
export declare class AdminService {
    private readonly userModel;
    private readonly listingModel;
    private readonly conversationModel;
    private readonly reviewModel;
    private readonly packagePurchaseModel;
    private readonly categoryModel;
    private readonly authService;
    private readonly notificationsService;
    constructor(userModel: Model<UserDocument>, listingModel: Model<ProductListingDocument>, conversationModel: Model<ConversationDocument>, reviewModel: Model<ReviewDocument>, packagePurchaseModel: Model<PackagePurchaseDocument>, categoryModel: Model<any>, authService: AuthService, notificationsService: NotificationsService);
    listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers>;
    getUserActivitySummary(userId: string): Promise<UserActivitySummary>;
    updateUserStatus(userId: string, status: UserStatus): Promise<UserDocument>;
    updateUserRole(userId: string, role: UserRole): Promise<UserDocument>;
    updateAdLimit(userId: string, adLimit: number): Promise<UserDocument>;
    getPendingListings(page?: number, limit?: number): Promise<PaginatedListings>;
    approveListing(listingId: string): Promise<ProductListingDocument>;
    rejectListing(listingId: string, reason: string): Promise<ProductListingDocument>;
    getAnalytics(dateFrom?: string, dateTo?: string): Promise<AnalyticsData>;
    exportAnalytics(dateFrom: string, dateTo: string): Promise<AnalyticsExport>;
    listPackagePurchases(query: ListPurchasesQueryDto): Promise<PaginatedPurchases>;
    listPayments(query: ListPaymentsQueryDto): Promise<PaginatedPurchases>;
    getSellerAdInfo(sellerId: string): Promise<SellerAdInfo>;
    private getKeyMetrics;
    private getTimeSeries;
    private getCategoryAnalytics;
}
