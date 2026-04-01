import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from '../users/schemas/user.schema.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  Conversation,
  ConversationDocument,
} from '../messaging/schemas/conversation.schema.js';
import {
  Review,
  ReviewDocument,
} from '../reviews/schemas/review.schema.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentStatus,
} from '../packages/schemas/package-purchase.schema.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { AdPackageType } from '../packages/schemas/ad-package.schema.js';

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
  count: number;
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
  dateRange: { from: string; to: string };
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

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(PackagePurchase.name)
    private readonly packagePurchaseModel: Model<PackagePurchaseDocument>,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const { page = 1, limit = 20, search, role, status, registeredFrom, registeredTo } = query;
    const filter: Record<string, any> = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { email: regex },
        { phone: regex },
        { 'profile.firstName': regex },
        { 'profile.lastName': regex },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.status = status;
    }

    if (registeredFrom || registeredTo) {
      filter.createdAt = {};
      if (registeredFrom) {
        filter.createdAt.$gte = new Date(registeredFrom);
      }
      if (registeredTo) {
        filter.createdAt.$lte = new Date(registeredTo);
      }
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-passwordHash -__v -mfa.totpSecret')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users as unknown as Record<string, unknown>[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserActivitySummary(userId: string): Promise<UserActivitySummary> {
    const userObjectId = new Types.ObjectId(userId);

    const [listingsCount, conversationsCount, violationsCount] =
      await Promise.all([
        this.listingModel.countDocuments({ sellerId: userObjectId }).exec(),
        this.conversationModel
          .countDocuments({
            $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }],
          })
          .exec(),
        this.reviewModel
          .countDocuments({
            sellerId: userObjectId,
            status: 'pending',
          })
          .exec(),
      ]);

    return { listingsCount, conversationsCount, violationsCount };
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = status;
    await user.save();

    if (status === UserStatus.SUSPENDED) {
      await this.authService.invalidateAllSessions(userId);
    }

    return user;
  }

  async updateUserRole(
    userId: string,
    role: UserRole,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = role;
    await user.save();

    // Invalidate JWT tokens so user gets new token with updated role
    await this.authService.invalidateAllSessions(userId);

    return user;
  }

  async updateAdLimit(
    userId: string,
    adLimit: number,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { adLimit } }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getPendingListings(
    page = 1,
    limit = 20,
  ): Promise<PaginatedListings> {
    const skip = (page - 1) * limit;
    const filter = { status: ListingStatus.PENDING_REVIEW };

    const [listings, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    return {
      data: listings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveListing(listingId: string): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    listing.status = ListingStatus.ACTIVE;
    await listing.save();

    return listing;
  }

  async rejectListing(
    listingId: string,
    reason: string,
  ): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    listing.status = ListingStatus.REJECTED;
    listing.rejectionReason = reason;
    await listing.save();

    // Notify the seller about the rejection
    await this.notificationsService.sendToUser(
      listing.sellerId.toString(),
      'productUpdates',
      {
        title: 'Listing rejected',
        body: `Your listing "${listing.title}" was rejected. Reason: ${reason}`,
        data: {
          type: 'listing_rejected',
          listingId: listing._id.toString(),
          reason,
        },
      },
    );

    return listing;
  }

  async getAnalytics(dateFrom?: string, dateTo?: string): Promise<AnalyticsData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const to = dateTo ? new Date(dateTo) : now;

    const [keyMetrics, timeSeries, categoryAnalytics] = await Promise.all([
      this.getKeyMetrics(thirtyDaysAgo),
      this.getTimeSeries(from, to),
      this.getCategoryAnalytics(),
    ]);

    return { keyMetrics, timeSeries, categoryAnalytics };
  }

  async exportAnalytics(dateFrom: string, dateTo: string): Promise<AnalyticsExport> {
    const analytics = await this.getAnalytics(dateFrom, dateTo);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
      keyMetrics: analytics.keyMetrics,
      timeSeries: analytics.timeSeries,
      categoryAnalytics: analytics.categoryAnalytics,
    };
  }

  async listPackagePurchases(query: ListPurchasesQueryDto): Promise<PaginatedPurchases> {
    const { page = 1, limit = 20, dateFrom, dateTo, sellerId, type, status } = query;
    const filter: Record<string, any> = {};

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (sellerId && Types.ObjectId.isValid(sellerId)) {
      filter.sellerId = new Types.ObjectId(sellerId);
    }

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.paymentStatus = status;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.packagePurchaseModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('packageId')
        .exec(),
      this.packagePurchaseModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listPayments(query: ListPaymentsQueryDto): Promise<PaginatedPurchases> {
    const { page = 1, limit = 20, dateFrom, dateTo, sellerId } = query;
    const filter: Record<string, any> = {
      paymentStatus: { $in: [PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.REFUNDED] },
    };

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (sellerId && Types.ObjectId.isValid(sellerId)) {
      filter.sellerId = new Types.ObjectId(sellerId);
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.packagePurchaseModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('packageId')
        .exec(),
      this.packagePurchaseModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSellerAdInfo(sellerId: string): Promise<SellerAdInfo> {
    const user = await this.userModel.findById(sellerId).exec();
    if (!user) {
      throw new NotFoundException('Seller not found');
    }

    const now = new Date();
    const activePackages = await this.packagePurchaseModel.aggregate([
      {
        $match: {
          sellerId: new Types.ObjectId(sellerId),
          type: AdPackageType.AD_SLOTS,
          paymentStatus: PaymentStatus.COMPLETED,
          expiresAt: { $gt: now },
          remainingQuantity: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalSlots: { $sum: '$remainingQuantity' },
        },
      },
    ]).exec();

    const activePackageSlots = activePackages[0]?.totalSlots || 0;
    const remainingFreeSlots = Math.max(0, user.adLimit - user.activeAdCount);

    return {
      sellerId,
      activeAdCount: user.activeAdCount,
      adLimit: user.adLimit,
      remainingFreeSlots,
      activePackageSlots,
    };
  }

  private async getKeyMetrics(thirtyDaysAgo: Date): Promise<AnalyticsData['keyMetrics']> {
    const [totalUsers, activeUsers, totalListings, totalConversations, purchaseAgg] =
      await Promise.all([
        this.userModel.countDocuments().exec(),
        this.userModel.countDocuments({ lastLoginAt: { $gte: thirtyDaysAgo } }).exec(),
        this.listingModel.countDocuments().exec(),
        this.conversationModel.countDocuments().exec(),
        this.packagePurchaseModel.aggregate([
          { $match: { paymentStatus: PaymentStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalPurchases: { $sum: 1 },
              totalRevenue: { $sum: '$price' },
            },
          },
        ]).exec(),
      ]);

    const purchaseData = purchaseAgg[0] || { totalPurchases: 0, totalRevenue: 0 };

    return {
      totalUsers,
      activeUsers,
      totalListings,
      totalConversations,
      totalPackagePurchases: purchaseData.totalPurchases,
      totalRevenue: purchaseData.totalRevenue,
    };
  }

  private async getTimeSeries(
    from: Date,
    to: Date,
  ): Promise<AnalyticsData['timeSeries']> {
    const dateMatch = { $gte: from, $lte: to };
    const groupByDate = {
      $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
    };

    const [registrations, listings, conversations, purchases] = await Promise.all([
      this.userModel.aggregate([
        { $match: { createdAt: dateMatch } },
        { $group: { _id: groupByDate, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]).exec(),
      this.listingModel.aggregate([
        { $match: { createdAt: dateMatch } },
        { $group: { _id: groupByDate, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]).exec(),
      this.conversationModel.aggregate([
        { $match: { createdAt: dateMatch } },
        { $group: { _id: groupByDate, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]).exec(),
      this.packagePurchaseModel.aggregate([
        { $match: { createdAt: dateMatch, paymentStatus: PaymentStatus.COMPLETED } },
        { $group: { _id: groupByDate, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]).exec(),
    ]);

    return { registrations, listings, conversations, purchases };
  }

  private async getCategoryAnalytics(): Promise<CategoryAnalytics[]> {
    return this.listingModel.aggregate([
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, categoryId: { $toString: '$_id' }, count: 1 } },
    ]).exec();
  }
}
