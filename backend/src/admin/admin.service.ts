import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from '../categories/schemas/category.schema.js';
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
import { Review, ReviewDocument } from '../reviews/schemas/review.schema.js';
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
import {
  UserActivity,
  UserActivityDocument,
} from '../ai/schemas/user-activity.schema.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { ERROR } from '../common/constants/error-messages.js';
import {
  IdVerification,
  IdVerificationDocument,
  IdVerificationStatus,
} from '../id-verification/schemas/id-verification.schema.js';
import {
  PaginatedUsers,
  PaginatedListings,
  UserActivitySummary,
  AnalyticsData,
  AnalyticsExport,
  PaginatedPurchases,
  SellerAdInfo,
  TimeSeriesEntry,
  CategoryAnalytics,
} from './interfaces/admin.interfaces.js';

export type {
  PaginatedUsers,
  PaginatedListings,
  UserActivitySummary,
  TimeSeriesEntry,
  CategoryAnalytics,
  AnalyticsData,
  AnalyticsExport,
  PaginatedPurchases,
  SellerAdInfo,
} from './interfaces/admin.interfaces.js';

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
    @InjectModel(Category.name)
    private readonly categoryModel: Model<any>,
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivityDocument>,
    @InjectModel('RejectionReason')
    private readonly rejectionReasonModel: Model<any>,
    @InjectModel('DeletionReason')
    private readonly deletionReasonModel: Model<any>,
    @InjectModel(IdVerification.name)
    private readonly idVerificationModel: Model<IdVerificationDocument>,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      registeredFrom,
      registeredTo,
    } = query;
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

    const [
      listingsCount,
      activeListingsCount,
      conversationsCount,
      violationsCount,
    ] = await Promise.all([
      this.listingModel
        .countDocuments({
          sellerId: userObjectId,
          status: { $ne: ListingStatus.DELETED },
        })
        .exec(),
      this.listingModel
        .countDocuments({
          sellerId: userObjectId,
          status: ListingStatus.ACTIVE,
        })
        .exec(),
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

    return {
      listingsCount,
      activeListingsCount,
      conversationsCount,
      violationsCount,
    };
  }

  async getUserActivePackages(userId: string): Promise<{
    count: number;
    packages: { name: string; type: string; expiresAt: string }[];
  }> {
    const now = new Date();
    const purchases = await this.packagePurchaseModel
      .find({
        sellerId: new Types.ObjectId(userId),
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $gt: now },
      })
      .populate('packageId', 'name type')
      .lean()
      .exec();

    return {
      count: purchases.length,
      packages: purchases.map((p: any) => ({
        name: p.packageId?.name || 'Unknown',
        type: p.packageId?.type || '',
        expiresAt: p.expiresAt?.toISOString() || '',
      })),
    };
  }

  async getUserActivityLog(
    userId: string,
    page = 1,
    limit = 50,
    action?: string,
  ): Promise<{
    data: UserActivityDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, any> = { userId: new Types.ObjectId(userId) };
    if (action) filter.action = action;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);

    return {
      data: data as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllActivityLog(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 50,
      action,
      userId,
      dateFrom,
      dateTo,
      sort = 'createdAt',
      order = 'desc',
    } = params;
    const filter: Record<string, any> = {};

    if (userId) filter.userId = new Types.ObjectId(userId);
    if (action) filter.action = action;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const sortObj: Record<string, 1 | -1> = {
      [sort]: order === 'asc' ? 1 : -1,
    };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.activityModel.countDocuments(filter).exec(),
    ]);

    return {
      data: data as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUserById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException(ERROR.USER_NOT_FOUND);
    return user;
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    user.status = status;
    await user.save();

    if (status === UserStatus.SUSPENDED) {
      await this.authService.invalidateAllSessions(userId);
    }

    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    user.role = role;
    await user.save();

    // Invalidate JWT tokens so user gets new token with updated role
    await this.authService.invalidateAllSessions(userId);

    return user;
  }

  async updateAdLimit(userId: string, adLimit: number): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { adLimit } }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    return user;
  }

  async updatePermissions(
    userId: string,
    permissions: string[],
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }
    if (user.role === UserRole.USER) {
      throw new ForbiddenException(
        'Cannot assign permissions to regular users. Change role to admin first.',
      );
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin already has all permissions.');
    }
    user.permissions = permissions;
    await user.save();
    return user;
  }

  async getPendingListings(page = 1, limit = 20): Promise<PaginatedListings> {
    const skip = (page - 1) * limit;
    const filter = { status: ListingStatus.PENDING_REVIEW };

    const [listings, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .populate('sellerId', 'email profile')
        .populate('categoryId', 'name')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    const enriched = listings.map((l: any) => ({
      ...l,
      sellerName: l.sellerId
        ? `${l.sellerId.profile?.firstName || ''} ${l.sellerId.profile?.lastName || ''}`.trim() ||
          l.sellerId.email
        : 'Unknown',
      sellerEmail: l.sellerId?.email || '',
      categoryName: l.categoryId?.name || 'Unknown',
      sellerId: l.sellerId?._id || l.sellerId,
      categoryId: l.categoryId?._id || l.categoryId,
    }));

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllListings(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    categoryId?: string;
    provinceId?: string;
    cityId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    rejectionReason?: string;
    deletionReason?: string;
  }): Promise<PaginatedListings> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      categoryId,
      provinceId,
      cityId,
      dateFrom,
      dateTo,
      sort,
      order,
      rejectionReason,
      deletionReason,
    } = params;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (categoryId) filter.categoryPath = new Types.ObjectId(categoryId);
    if (provinceId)
      filter['location.provinceId'] = new Types.ObjectId(provinceId);
    if (cityId) filter['location.cityId'] = new Types.ObjectId(cityId);
    if (rejectionReason)
      filter.rejectionReason = new RegExp(rejectionReason, 'i');
    if (deletionReason) filter.deletionReason = new RegExp(deletionReason, 'i');
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59');
    }

    const sortObj: Record<string, 1 | -1> = {};
    if (sort) {
      sortObj[sort] = order === 'asc' ? 1 : -1;
    } else {
      sortObj.createdAt = -1;
    }

    const [listings, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .populate('sellerId', 'email profile')
        .populate('categoryId', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    const enriched = listings.map((l: any) => ({
      ...l,
      sellerName: l.sellerId
        ? `${l.sellerId.profile?.firstName || ''} ${l.sellerId.profile?.lastName || ''}`.trim() ||
          l.sellerId.email
        : 'Unknown',
      sellerEmail: l.sellerId?.email || '',
      categoryName: l.categoryId?.name || 'Unknown',
      sellerId: l.sellerId?._id || l.sellerId,
      categoryId: l.categoryId?._id || l.categoryId,
    }));

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findListingById(listingId: string): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    return listing;
  }

  async approveListing(listingId: string): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    listing.status = ListingStatus.ACTIVE;
    await listing.save();

    return listing;
  }

  async rejectListing(
    listingId: string,
    rejectionReasonIds: string[],
    customNote?: string,
  ): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    // Fetch reason titles for notification
    const reasons = await this.rejectionReasonModel
      .find({
        _id: { $in: rejectionReasonIds.map((id) => new Types.ObjectId(id)) },
      })
      .lean()
      .exec();
    const reasonTitles = reasons.map((r: any) => r.title);

    listing.status = ListingStatus.REJECTED;
    listing.rejectionReasonIds = rejectionReasonIds.map(
      (id) => new Types.ObjectId(id),
    );
    listing.rejectionNote = customNote || undefined;
    listing.rejectionReason =
      reasonTitles.join(', ') + (customNote ? ` — ${customNote}` : '');
    (listing as any).rejectedAt = new Date();
    (listing as any).rejectionCount =
      ((listing as any).rejectionCount || 0) + 1;
    await listing.save();

    // Notify the seller
    const reasonText =
      reasonTitles.join(', ') + (customNote ? `. Note: ${customNote}` : '');
    await this.notificationsService.sendToUser(
      listing.sellerId.toString(),
      'productUpdates',
      {
        title: 'Listing rejected',
        body: `Your listing "${listing.title}" was rejected. Reasons: ${reasonText}`,
        data: {
          type: 'listing_rejected',
          listingId: listing._id.toString(),
          reasons: reasonTitles.join(', '),
          note: customNote || '',
        },
      },
    );

    return listing;
  }

  async getAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<AnalyticsData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const to = dateTo ? new Date(dateTo) : now;

    const [keyMetrics, timeSeries, categoryAnalytics] = await Promise.all([
      this.getKeyMetrics(thirtyDaysAgo),
      this.getTimeSeries(from, to),
      this.getCategoryAnalytics(),
    ]);

    return { keyMetrics, timeSeries, categoryAnalytics };
  }

  async exportAnalytics(
    dateFrom: string,
    dateTo: string,
  ): Promise<AnalyticsExport> {
    const analytics = await this.getAnalytics(dateFrom, dateTo);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
      keyMetrics: analytics.keyMetrics,
      timeSeries: analytics.timeSeries,
      categoryAnalytics: analytics.categoryAnalytics,
    };
  }

  async listPackagePurchases(
    query: ListPurchasesQueryDto,
  ): Promise<PaginatedPurchases> {
    const {
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
      sellerId,
      type,
      status,
    } = query;
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
    const {
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
      sellerId,
      paymentMethod,
      status,
    } = query as any;
    const filter: Record<string, any> = {};

    // If status filter is provided, use it; otherwise show all non-pending
    if (status) {
      filter.paymentStatus = status;
    } else {
      filter.paymentStatus = {
        $in: [
          PaymentStatus.COMPLETED,
          PaymentStatus.FAILED,
          PaymentStatus.REFUNDED,
          PaymentStatus.PENDING,
        ],
      };
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    if (sellerId && Types.ObjectId.isValid(sellerId)) {
      filter.sellerId = new Types.ObjectId(sellerId);
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
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
      throw new NotFoundException(ERROR.SELLER_NOT_FOUND);
    }

    const now = new Date();
    const activePackages = await this.packagePurchaseModel
      .aggregate([
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
      ])
      .exec();

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

  private async getKeyMetrics(
    thirtyDaysAgo: Date,
  ): Promise<AnalyticsData['keyMetrics']> {
    const [
      totalUsers,
      activeUsers,
      totalListings,
      totalConversations,
      purchaseAgg,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel
        .countDocuments({ lastLoginAt: { $gte: thirtyDaysAgo } })
        .exec(),
      this.listingModel.countDocuments().exec(),
      this.conversationModel.countDocuments().exec(),
      this.packagePurchaseModel
        .aggregate([
          { $match: { paymentStatus: PaymentStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalPurchases: { $sum: 1 },
              totalRevenue: { $sum: '$price' },
            },
          },
        ])
        .exec(),
    ]);

    const purchaseData = purchaseAgg[0] || {
      totalPurchases: 0,
      totalRevenue: 0,
    };

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

    const [registrations, listings, conversations, purchases] =
      await Promise.all([
        this.userModel
          .aggregate([
            { $match: { createdAt: dateMatch } },
            { $group: { _id: groupByDate, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', count: 1 } },
          ])
          .exec(),
        this.listingModel
          .aggregate([
            { $match: { createdAt: dateMatch } },
            { $group: { _id: groupByDate, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', count: 1 } },
          ])
          .exec(),
        this.conversationModel
          .aggregate([
            { $match: { createdAt: dateMatch } },
            { $group: { _id: groupByDate, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', count: 1 } },
          ])
          .exec(),
        this.packagePurchaseModel
          .aggregate([
            {
              $match: {
                createdAt: dateMatch,
                paymentStatus: PaymentStatus.COMPLETED,
              },
            },
            { $group: { _id: groupByDate, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', count: 1 } },
          ])
          .exec(),
      ]);

    return { registrations, listings, conversations, purchases };
  }

  private async getCategoryAnalytics(): Promise<CategoryAnalytics[]> {
    const raw = await this.listingModel
      .aggregate([
        { $match: { categoryId: { $ne: null } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .exec();

    // Look up category names
    const catIds = raw.map((r: any) => r._id).filter(Boolean);
    const categories = await this.categoryModel
      .find({ _id: { $in: catIds } })
      .select('name')
      .lean()
      .exec();
    const catMap = new Map(
      categories.map((c: any) => [c._id.toString(), c.name]),
    );

    return raw
      .filter((r: any) => catMap.has(r._id?.toString()))
      .map((r: any) => ({
        categoryId: r._id?.toString() ?? '',
        categoryName: catMap.get(r._id?.toString()),
        listingCount: r.count,
      }));
  }

  // ── Rejection Reasons CRUD ──────────────────────────────────────

  async getRejectionReasons(activeOnly = false): Promise<any[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.rejectionReasonModel
      .find(filter)
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async findRejectionReasonById(id: string): Promise<any> {
    const reason = await this.rejectionReasonModel.findById(id).lean().exec();
    if (!reason) throw new NotFoundException(ERROR.REJECTION_REASON_NOT_FOUND);
    return reason;
  }

  async createRejectionReason(data: {
    title: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<any> {
    return await new this.rejectionReasonModel(data).save();
  }

  async updateRejectionReason(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      isActive: boolean;
      sortOrder: number;
    }>,
  ): Promise<any> {
    const reason = await this.rejectionReasonModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!reason) throw new NotFoundException(ERROR.REJECTION_REASON_NOT_FOUND);
    return reason;
  }

  async deleteRejectionReason(id: string): Promise<void> {
    const result = await this.rejectionReasonModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(ERROR.REJECTION_REASON_NOT_FOUND);
  }

  // ── Engagement Analytics ────────────────────────────────────────

  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
  ): Record<string, any> {
    const filter: Record<string, any> = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    return filter;
  }

  async getEngagementAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    // For login failures, use date range if provided, otherwise last 7 days
    const loginFailureDateMatch =
      dateFrom || dateTo
        ? dateFilter.createdAt
          ? { createdAt: dateFilter.createdAt }
          : {}
        : { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } };

    // For top viewed listings, build a date filter on createdAt
    const listingDateFilter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      viewCount: { $gt: 0 },
    };
    if (dateFilter.createdAt) {
      listingDateFilter.createdAt = dateFilter.createdAt;
    }

    const guestVsAuthActions = [
      UserAction.VIEW,
      UserAction.SEARCH,
      UserAction.CATEGORY_BROWSE,
      UserAction.PAGE_VIEW,
    ];

    const [
      guestVsAuth,
      topSearches,
      topViewedListings,
      loginFailures,
      actionBreakdown,
      deviceBreakdown,
      hourlyActivity,
    ] = await Promise.all([
      // Guest vs Authenticated activity counts
      this.activityModel
        .aggregate([
          {
            $match: {
              action: { $in: guestVsAuthActions },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                action: '$action',
                isGuest: {
                  $cond: [{ $ifNull: ['$userId', false] }, false, true],
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),

      // Top search terms (from activity metadata)
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.SEARCH,
              searchQuery: { $ne: null },
              ...dateFilter,
            },
          },
          { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 30 },
        ])
        .exec(),

      // Top viewed listings
      this.listingModel
        .find(listingDateFilter)
        .sort({ viewCount: -1 })
        .limit(30)
        .select('title viewCount favoriteCount categoryId price')
        .lean()
        .exec(),

      // Login failures
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.LOGIN_FAILED,
              ...loginFailureDateMatch,
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),

      // Action type breakdown
      this.activityModel
        .aggregate([
          { $match: { ...dateFilter } },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ])
        .exec(),

      // Device type breakdown
      this.activityModel
        .aggregate([
          {
            $match: { 'metadata.deviceType': { $exists: true }, ...dateFilter },
          },
          {
            $group: {
              _id: '$metadata.deviceType',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .exec(),

      // Hourly activity distribution
      this.activityModel
        .aggregate([
          { $match: { ...dateFilter } },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
    ]);

    // Format guest vs auth
    const guestVsAuthFormatted: Record<
      string,
      { guest: number; authenticated: number }
    > = {};
    for (const row of guestVsAuth) {
      const action = row._id.action;
      if (!guestVsAuthFormatted[action]) {
        guestVsAuthFormatted[action] = { guest: 0, authenticated: 0 };
      }
      if (row._id.isGuest) {
        guestVsAuthFormatted[action].guest = row.count;
      } else {
        guestVsAuthFormatted[action].authenticated = row.count;
      }
    }

    return {
      guestVsAuth: guestVsAuthFormatted,
      topSearches: topSearches.map((s: any) => ({
        term: s._id,
        count: s.count,
      })),
      topViewedListings: topViewedListings.map((l: any) => ({
        _id: l._id?.toString(),
        title: l.title,
        viewCount: l.viewCount,
        favoriteCount: l.favoriteCount,
        price: l.price,
      })),
      loginFailures: loginFailures.map((f: any) => ({
        date: f._id,
        count: f.count,
      })),
      actionBreakdown: actionBreakdown.map((a: any) => ({
        action: a._id,
        count: a.count,
      })),
      deviceBreakdown: deviceBreakdown.map((d: any) => ({
        device: d._id || 'unknown',
        count: d.count,
      })),
      hourlyActivity: hourlyActivity.map((h: any) => ({
        hour: h._id,
        count: h.count,
      })),
    };
  }

  // ── App Banner Stats ─────────────────────────────────────────────

  async getAppBannerStats(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    shown: number;
    clicks: number;
    dismissals: number;
    clickRate: number;
    dismissRate: number;
    byPlatform: {
      platform: string;
      shown: number;
      clicks: number;
      dismissals: number;
    }[];
  }> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const bannerActions = [
      UserAction.APP_BANNER_SHOWN,
      UserAction.APP_BANNER_CLICK,
      UserAction.APP_BANNER_DISMISS,
    ];

    const [shown, clicks, dismissals, platformBreakdown] = await Promise.all([
      this.activityModel
        .countDocuments({ action: UserAction.APP_BANNER_SHOWN, ...dateFilter })
        .exec(),
      this.activityModel
        .countDocuments({ action: UserAction.APP_BANNER_CLICK, ...dateFilter })
        .exec(),
      this.activityModel
        .countDocuments({
          action: UserAction.APP_BANNER_DISMISS,
          ...dateFilter,
        })
        .exec(),
      this.activityModel
        .aggregate([
          {
            $match: {
              action: { $in: bannerActions },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                platform: { $ifNull: ['$metadata.platform', 'unknown'] },
                action: '$action',
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    // Build platform breakdown
    const platformMap = new Map<
      string,
      { shown: number; clicks: number; dismissals: number }
    >();
    for (const row of platformBreakdown) {
      const platform = row._id.platform;
      if (!platformMap.has(platform)) {
        platformMap.set(platform, { shown: 0, clicks: 0, dismissals: 0 });
      }
      const entry = platformMap.get(platform)!;
      if (row._id.action === UserAction.APP_BANNER_SHOWN)
        entry.shown = row.count;
      else if (row._id.action === UserAction.APP_BANNER_CLICK)
        entry.clicks = row.count;
      else if (row._id.action === UserAction.APP_BANNER_DISMISS)
        entry.dismissals = row.count;
    }

    return {
      shown,
      clicks,
      dismissals,
      clickRate: shown > 0 ? Math.round((clicks / shown) * 10000) / 100 : 0,
      dismissRate:
        shown > 0 ? Math.round((dismissals / shown) * 10000) / 100 : 0,
      byPlatform: Array.from(platformMap.entries()).map(
        ([platform, stats]) => ({
          platform,
          ...stats,
        }),
      ),
    };
  }

  // ── Category Price Trends ───────────────────────────────────────

  async getCategoryPriceTrends(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    categories: {
      categoryId: string;
      categoryName: string;
      totalChanges: number;
      avgPreviousPrice: number;
      avgNewPrice: number;
      avgDiff: number;
      avgDiffPct: number;
      direction: 'up' | 'down' | 'stable';
    }[];
    recentChanges: {
      listingId: string;
      title: string;
      categoryName: string;
      previousPrice: number;
      newPrice: number;
      diff: number;
      date: string;
    }[];
    totalPriceChanges: number;
    avgPriceIncrease: number;
    avgPriceDecrease: number;
  }> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const [categoryAgg, recentChanges, summaryAgg] = await Promise.all([
      // Per-category average price change
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.LISTING_PRICE_CHANGE,
              'metadata.previousPrice': { $exists: true },
              'metadata.newPrice': { $exists: true },
              categoryId: { $exists: true },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: '$categoryId',
              totalChanges: { $sum: 1 },
              avgPreviousPrice: { $avg: '$metadata.previousPrice' },
              avgNewPrice: { $avg: '$metadata.newPrice' },
              avgDiff: { $avg: '$metadata.priceDiff' },
            },
          },
          { $sort: { totalChanges: -1 } },
          { $limit: 20 },
        ])
        .exec(),

      // Recent individual price changes
      this.activityModel
        .find({
          action: UserAction.LISTING_PRICE_CHANGE,
          'metadata.previousPrice': { $exists: true },
          ...dateFilter,
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec(),

      // Overall summary: avg increase vs decrease
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.LISTING_PRICE_CHANGE,
              'metadata.priceDiff': { $exists: true },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              avgIncrease: {
                $avg: {
                  $cond: [
                    { $gt: ['$metadata.priceDiff', 0] },
                    '$metadata.priceDiff',
                    null,
                  ],
                },
              },
              avgDecrease: {
                $avg: {
                  $cond: [
                    { $lt: ['$metadata.priceDiff', 0] },
                    '$metadata.priceDiff',
                    null,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
    ]);

    // Resolve category names
    const categoryIds = categoryAgg.map((c: any) => c._id).filter(Boolean);
    const categories =
      categoryIds.length > 0
        ? await this.categoryModel
            .find({ _id: { $in: categoryIds } })
            .select('name')
            .lean()
            .exec()
        : [];
    const catNameMap = new Map(
      categories.map((c: any) => [c._id.toString(), c.name]),
    );

    const summary = summaryAgg[0] || {
      total: 0,
      avgIncrease: 0,
      avgDecrease: 0,
    };

    return {
      categories: categoryAgg.map((c: any) => {
        const avgPrev = Math.round(c.avgPreviousPrice || 0);
        const avgNew = Math.round(c.avgNewPrice || 0);
        const avgDiff = Math.round(c.avgDiff || 0);
        const avgDiffPct =
          avgPrev > 0 ? Math.round((avgDiff / avgPrev) * 10000) / 100 : 0;
        return {
          categoryId: c._id?.toString() || '',
          categoryName: catNameMap.get(c._id?.toString()) || 'Unknown',
          totalChanges: c.totalChanges,
          avgPreviousPrice: avgPrev,
          avgNewPrice: avgNew,
          avgDiff,
          avgDiffPct,
          direction:
            avgDiff > 0
              ? ('up' as const)
              : avgDiff < 0
                ? ('down' as const)
                : ('stable' as const),
        };
      }),
      recentChanges: recentChanges.map((r: any) => ({
        listingId: r.productListingId?.toString() || '',
        title: r.metadata?.title || '',
        categoryName: r.metadata?.categoryName || '',
        previousPrice: r.metadata?.previousPrice || 0,
        newPrice: r.metadata?.newPrice || 0,
        diff: r.metadata?.priceDiff || 0,
        date: r.createdAt?.toISOString?.() || '',
      })),
      totalPriceChanges: summary.total,
      avgPriceIncrease: Math.round(summary.avgIncrease || 0),
      avgPriceDecrease: Math.round(summary.avgDecrease || 0),
    };
  }

  // ── Deletion Reasons CRUD ───────────────────────────────────────

  async getDeletionReasons(activeOnly = false): Promise<any[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.deletionReasonModel
      .find(filter)
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async findDeletionReasonById(id: string): Promise<any> {
    const reason = await this.deletionReasonModel.findById(id).lean().exec();
    if (!reason) throw new NotFoundException(ERROR.DELETION_REASON_NOT_FOUND);
    return reason;
  }

  async createDeletionReason(data: {
    title: string;
    description?: string;
    isActive?: boolean;
  }): Promise<any> {
    return await new this.deletionReasonModel(data).save();
  }

  async updateDeletionReason(
    id: string,
    data: Partial<{ title: string; description: string; isActive: boolean }>,
  ): Promise<any> {
    const reason = await this.deletionReasonModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!reason) throw new NotFoundException(ERROR.DELETION_REASON_NOT_FOUND);
    return reason;
  }

  async deleteDeletionReason(id: string): Promise<void> {
    const result = await this.deletionReasonModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(ERROR.DELETION_REASON_NOT_FOUND);
  }

  // ── Social Login Analytics ──────────────────────────────────────

  async getSocialLoginAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const [byProvider, timeSeries, newVsReturning] = await Promise.all([
      this.activityModel
        .aggregate([
          { $match: { action: UserAction.SOCIAL_LOGIN, ...dateFilter } },
          { $group: { _id: '$metadata.provider', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .exec(),

      this.activityModel
        .aggregate([
          { $match: { action: UserAction.SOCIAL_LOGIN, ...dateFilter } },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                provider: '$metadata.provider',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ])
        .exec(),

      this.activityModel
        .aggregate([
          { $match: { action: UserAction.SOCIAL_LOGIN, ...dateFilter } },
          {
            $group: {
              _id: null,
              newUsers: {
                $sum: {
                  $cond: [{ $eq: ['$metadata.isNewUser', true] }, 1, 0],
                },
              },
              returningUsers: {
                $sum: {
                  $cond: [{ $ne: ['$metadata.isNewUser', true] }, 1, 0],
                },
              },
            },
          },
        ])
        .exec(),
    ]);

    const dateMap = new Map<
      string,
      { google: number; facebook: number; apple: number }
    >();
    for (const row of timeSeries) {
      const date = row._id.date;
      if (!dateMap.has(date))
        dateMap.set(date, { google: 0, facebook: 0, apple: 0 });
      const entry = dateMap.get(date)!;
      const provider = row._id.provider as string;
      if (provider === 'google') entry.google = row.count;
      else if (provider === 'facebook') entry.facebook = row.count;
      else if (provider === 'apple') entry.apple = row.count;
    }

    const totalSocialLogins = byProvider.reduce(
      (sum: number, r: any) => sum + r.count,
      0,
    );
    const nvr = newVsReturning[0] || { newUsers: 0, returningUsers: 0 };

    return {
      totalSocialLogins,
      byProvider: byProvider.map((r: any) => ({
        provider: r._id || 'unknown',
        count: r.count,
      })),
      timeSeries: Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      })),
      newVsReturning: {
        newUsers: nvr.newUsers,
        returningUsers: nvr.returningUsers,
      },
    };
  }

  // ── User Retention Analytics ────────────────────────────────────

  async getUserRetentionAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const [dau, wau, mau, activeLastMonth, activeThisMonth] = await Promise.all(
      [
        this.activityModel
          .aggregate([
            { $match: { userId: { $exists: true }, ...dateFilter } },
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                  },
                  userId: '$userId',
                },
              },
            },
            { $group: { _id: '$_id.date', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ])
          .exec(),

        this.activityModel
          .aggregate([
            { $match: { userId: { $exists: true }, ...dateFilter } },
            {
              $group: {
                _id: {
                  week: {
                    $dateToString: { format: '%Y-W%V', date: '$createdAt' },
                  },
                  userId: '$userId',
                },
              },
            },
            { $group: { _id: '$_id.week', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ])
          .exec(),

        this.activityModel
          .aggregate([
            { $match: { userId: { $exists: true }, ...dateFilter } },
            {
              $group: {
                _id: {
                  month: {
                    $dateToString: { format: '%Y-%m', date: '$createdAt' },
                  },
                  userId: '$userId',
                },
              },
            },
            { $group: { _id: '$_id.month', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ])
          .exec(),

        this.activityModel
          .distinct('userId', {
            userId: { $exists: true },
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
          })
          .exec(),

        this.activityModel
          .distinct('userId', {
            userId: { $exists: true },
            createdAt: { $gte: thirtyDaysAgo },
          })
          .exec(),
      ],
    );

    const lastMonthSet = new Set(
      activeLastMonth.map((id: any) => id.toString()),
    );
    const thisMonthSet = new Set(
      activeThisMonth.map((id: any) => id.toString()),
    );
    const retained = [...lastMonthSet].filter((id) =>
      thisMonthSet.has(id),
    ).length;
    const churnedUsers = lastMonthSet.size - retained;
    const retentionRate =
      lastMonthSet.size > 0
        ? Math.round((retained / lastMonthSet.size) * 10000) / 100
        : 0;

    return {
      dailyActiveUsers: dau.map((d: any) => ({
        date: d._id,
        count: d.count,
      })),
      weeklyActiveUsers: wau.map((w: any) => ({
        week: w._id,
        count: w.count,
      })),
      monthlyActiveUsers: mau.map((m: any) => ({
        month: m._id,
        count: m.count,
      })),
      churnedUsers,
      retentionRate,
    };
  }

  // ── Revenue Analytics ───────────────────────────────────────────

  async getRevenueAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter: Record<string, any> = {
      paymentStatus: PaymentStatus.COMPLETED,
    };
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = to;
      }
    }

    const [byMethod, byType, timeSeries, summary] = await Promise.all([
      this.packagePurchaseModel
        .aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: '$paymentMethod',
              revenue: { $sum: '$price' },
              count: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
        ])
        .exec(),

      this.packagePurchaseModel
        .aggregate([
          { $match: dateFilter },
          {
            $lookup: {
              from: 'ad_packages',
              localField: 'packageId',
              foreignField: '_id',
              as: 'pkg',
            },
          },
          { $unwind: { path: '$pkg', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$pkg.type',
              revenue: { $sum: '$price' },
              count: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
        ])
        .exec(),

      this.packagePurchaseModel
        .aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              revenue: { $sum: '$price' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),

      this.packagePurchaseModel
        .aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$price' },
              totalCount: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    const s = summary[0] || { totalRevenue: 0, totalCount: 0 };

    return {
      totalRevenue: s.totalRevenue,
      byPaymentMethod: byMethod.map((r: any) => ({
        method: r._id || 'unknown',
        revenue: r.revenue,
        count: r.count,
      })),
      byPackageType: byType.map((r: any) => ({
        type: r._id || 'unknown',
        revenue: r.revenue,
        count: r.count,
      })),
      revenueTimeSeries: timeSeries.map((r: any) => ({
        date: r._id,
        revenue: r.revenue,
        count: r.count,
      })),
      avgOrderValue:
        s.totalCount > 0 ? Math.round(s.totalRevenue / s.totalCount) : 0,
    };
  }

  // ── ID Verification Analytics ──────────────────────────────────

  async getIdVerificationStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    timeSeries: {
      date: string;
      submitted: number;
      approved: number;
      rejected: number;
    }[];
  }> {
    const [statusCounts, timeSeries] = await Promise.all([
      this.idVerificationModel
        .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .exec(),
      this.idVerificationModel
        .aggregate([
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ])
        .exec(),
    ]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row._id] = row.count;
    }

    // Build time series grouped by date
    const dateMap = new Map<
      string,
      { submitted: number; approved: number; rejected: number }
    >();
    for (const row of timeSeries) {
      const date = row._id.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { submitted: 0, approved: 0, rejected: 0 });
      }
      const entry = dateMap.get(date)!;
      if (row._id.status === IdVerificationStatus.PENDING)
        entry.submitted += row.count;
      else if (row._id.status === IdVerificationStatus.APPROVED) {
        entry.approved += row.count;
        entry.submitted += row.count;
      } else if (row._id.status === IdVerificationStatus.REJECTED) {
        entry.rejected += row.count;
        entry.submitted += row.count;
      }
    }

    const total =
      (counts['pending'] || 0) +
      (counts['approved'] || 0) +
      (counts['rejected'] || 0);

    return {
      total,
      pending: counts['pending'] || 0,
      approved: counts['approved'] || 0,
      rejected: counts['rejected'] || 0,
      timeSeries: Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      })),
    };
  }
}
