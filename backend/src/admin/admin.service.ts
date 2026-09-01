import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from '../categories/schemas/category.schema.js';
import { ConfigService } from '@nestjs/config';
import { containsRegex } from '../common/utils/sanitize-regex.js';
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
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { AdPackageType } from '../packages/schemas/ad-package.schema.js';
import { EntitlementKind, purchaseBalances } from '../packages/entitlements.js';
import { PackagesService } from '../packages/packages.service.js';
import {
  UserActivity,
  UserActivityDocument,
} from '../ai/schemas/user-activity.schema.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import {
  IdVerification,
  IdVerificationDocument,
  IdVerificationStatus,
} from '../id-verification/schemas/id-verification.schema.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import {
  PaginatedUsers,
  PaginatedListings,
  UserActivitySummary,
  AnalyticsData,
  AnalyticsExport,
  PeriodDelta,
  PaginatedPurchases,
  SellerAdInfo,
  TimeSeriesEntry,
  CategoryAnalytics,
} from './interfaces/admin.interfaces.js';
import { daysToMs } from '../common/utils/time.js';

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
  private readonly activeDays: number;
  /** Timezone that time-of-day reporting is bucketed into. */
  private readonly timezone: string;
  private readonly logger = new Logger(AdminService.name);

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
    private readonly configService: ConfigService,
    private readonly searchSyncService: SearchSyncService,
    @Inject(forwardRef(() => PackagesService))
    private readonly packagesService: PackagesService,
  ) {
    this.activeDays = this.configService.get<number>('listing.activeDays')!;
    // Falls back rather than trusting the non-null assertion: an undefined
    // timezone reaches MongoDB's $dateToString on every dated aggregation, and a
    // silently wrong day boundary is worse than an obvious default.
    this.timezone =
      this.configService.get<string>('reportingTimezone') ?? 'Asia/Karachi';
  }

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
      const regex = containsRegex(search);
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
    if (!user) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return user;
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    user.status = status;
    await user.save();

    if (status === UserStatus.SUSPENDED) {
      await this.authService.invalidateAllSessions(userId);

      // Deactivate all active listings and unfeature them
      const activeListings = await this.listingModel
        .find({
          sellerId: new Types.ObjectId(userId),
          status: ListingStatus.ACTIVE,
        })
        .select('_id')
        .lean()
        .exec();

      await this.listingModel.updateMany(
        {
          sellerId: new Types.ObjectId(userId),
          status: ListingStatus.ACTIVE,
        },
        {
          $set: {
            status: ListingStatus.INACTIVE,
            deactivatedAt: new Date(),
            isFeatured: false,
            updatedAt: new Date(),
          },
          $unset: { featuredUntil: '' },
        },
      );

      // Remove deactivated listings from search index
      for (const listing of activeListings) {
        this.removeFromEs(listing._id.toString());
      }

      // Reset activeListingCount to 0 since all listings are now inactive
      if (activeListings.length > 0) {
        await this.userModel
          .updateOne(
            { _id: new Types.ObjectId(userId) },
            { $inc: { activeListingCount: -activeListings.length } },
          )
          .exec();
      }

      // Notify the seller
      this.notificationsService
        .sendAccountSuspendedNotification(userId)
        .catch(() => {});
    }

    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    user.role = role;
    await user.save();

    // Invalidate JWT tokens so user gets new token with updated role
    await this.authService.invalidateAllSessions(userId);

    return user;
  }

  /**
   * Sets a seller's own allowance, leaving package-granted slots alone.
   *
   * The number an admin types is the *base*; the effective `listingLimit` is that
   * plus whatever packages are active, recomputed here. Writing `listingLimit`
   * directly used to collide with the package accounting: setting 3 while a
   * 20-slot package was live made expiry compute `max(10, 3 - 20)` and *raise* the
   * limit to 10, and a goodwill grant of 100 quietly lost 20 when that package
   * lapsed.
   */
  async updateListingLimit(
    userId: string,
    listingLimit: number,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { baseListingLimit: listingLimit } },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    await this.packagesService.reconcileListingLimit(userId);

    // Re-read so the caller sees the derived limit, not the pre-reconcile value.
    return (await this.userModel.findById(userId).exec()) ?? user;
  }

  async updatePermissions(
    userId: string,
    permissions: string[],
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (user.role === UserRole.USER) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
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
      filter.rejectionReason = containsRegex(rejectionReason);
    if (deletionReason) filter.deletionReason = containsRegex(deletionReason);
    if (search) {
      const regex = containsRegex(search);
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
    if (!listing) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return listing;
  }

  async approveListing(listingId: string): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    listing.status = ListingStatus.ACTIVE;
    // Start the expiry clock from approval, not creation
    listing.expiresAt = new Date(Date.now() + daysToMs(this.activeDays));
    await listing.save();

    this.syncToEs(listing);
    return listing;
  }

  async rejectListing(
    listingId: string,
    rejectionReasonIds: string[],
    customNote?: string,
  ): Promise<ProductListingDocument> {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
      NotificationType.PRODUCT_UPDATES,
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

    this.removeFromEs(listing._id.toString());
    return listing;
  }

  async getAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<AnalyticsData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - daysToMs(30));
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const to = dateTo ? new Date(dateTo) : now;

    const [keyMetrics, timeSeries, categoryAnalytics, comparison] =
      await Promise.all([
        this.getKeyMetrics(thirtyDaysAgo),
        this.getTimeSeries(from, to),
        this.getCategoryAnalytics(),
        this.getPeriodComparison(from, to),
      ]);

    return { keyMetrics, timeSeries, categoryAnalytics, comparison };
  }

  /**
   * Every report in one call.
   *
   * Exists so an operator can take the whole picture away in one file instead of
   * visiting eight screens and downloading eight of them. Each per-screen export
   * still exists for when only one report is wanted.
   *
   * Runs thirteen reports concurrently, which is a heavy request by design — it
   * is an on-demand admin action, not something on a hot path. `Promise.all`
   * rather than sequential awaits keeps it to roughly the cost of the slowest
   * report rather than the sum of all of them.
   */
  async exportAnalytics(
    dateFrom: string,
    dateTo: string,
  ): Promise<AnalyticsExport> {
    const [
      analytics,
      engagement,
      appBanner,
      voiceSearch,
      priceTrends,
      retention,
      revenue,
      otp,
      socialLogins,
      traffic,
      listingFunnel,
      behaviour,
      idVerification,
    ] = await Promise.all([
      this.getAnalytics(dateFrom, dateTo),
      this.getEngagementAnalytics(dateFrom, dateTo),
      this.getAppBannerStats(dateFrom, dateTo),
      this.getVoiceSearchAnalytics(dateFrom, dateTo),
      this.getCategoryPriceTrends(dateFrom, dateTo),
      this.getUserRetentionAnalytics(dateFrom, dateTo),
      this.getRevenueAnalytics(dateFrom, dateTo),
      this.getOtpAnalytics(dateFrom, dateTo),
      this.getSocialLoginAnalytics(dateFrom, dateTo),
      this.getTrafficAnalytics(dateFrom, dateTo),
      this.getListingFunnelAnalytics(dateFrom, dateTo),
      this.getBehaviourAnalytics(dateFrom, dateTo),
      this.getIdVerificationStats(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
      timezone: this.timezone,
      keyMetrics: analytics.keyMetrics,
      timeSeries: analytics.timeSeries,
      categoryAnalytics: analytics.categoryAnalytics,
      comparison: analytics.comparison,
      engagement,
      appBanner,
      voiceSearch,
      priceTrends,
      retention,
      revenue,
      otp,
      socialLogins,
      traffic,
      listingFunnel,
      behaviour,
      idVerification,
    };
  }

  /**
   * Renders a full export as one sectioned CSV.
   *
   * A single sheet with labelled sections rather than a real workbook: it needs
   * no spreadsheet library, opens in anything, and greps cleanly. Every value is
   * quoted and inner quotes are doubled, so a listing title containing a comma
   * or a quote cannot shift the columns.
   */
  buildAnalyticsCsv(report: AnalyticsExport): string {
    const lines: string[] = [];
    const cell = (value: unknown): string => {
      if (value === null || value === undefined) return '""';
      // Anything that is not a primitive would stringify to "[object Object]",
      // which tells whoever opens the sheet nothing at all. JSON at least keeps
      // the contents legible.
      const text =
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const row = (...cols: unknown[]) => lines.push(cols.map(cell).join(','));
    const blank = () => lines.push('');
    const section = (title: string) => {
      blank();
      row(title.toUpperCase());
    };
    /** Writes a table, or a placeholder so an empty report is not mistaken for a missing one. */
    const table = (
      title: string,
      header: string[],
      rows: unknown[][],
      emptyNote = 'No data in this range',
    ) => {
      section(title);
      if (rows.length === 0) {
        row(emptyNote);
        return;
      }
      row(...header);
      for (const r of rows) row(...r);
    };
    const pairs = (title: string, entries: [string, unknown][]) => {
      section(title);
      row('Metric', 'Value');
      for (const [label, value] of entries) row(label, value);
    };

    row('COMPLETE ANALYTICS EXPORT');
    row('Date range', `${report.dateRange.from} to ${report.dateRange.to}`);
    row('Generated', report.generatedAt);
    row('Reporting timezone', report.timezone);
    row('Note', 'Dates are bucketed in the reporting timezone above, not UTC.');

    const km = report.keyMetrics as Record<string, any>;
    pairs('Key metrics', [
      ['Total users', km?.totalUsers ?? 0],
      ['Active users (30d)', km?.activeUsers ?? 0],
      ['Total listings', km?.totalListings ?? 0],
      ['Conversations', km?.totalConversations ?? 0],
      ['Purchases', km?.totalPurchases ?? 0],
      ['Revenue', km?.totalRevenue ?? 0],
    ]);

    const cmp = report.comparison as Record<string, any> | undefined;
    if (cmp) {
      section('Period comparison');
      row('This period', `${cmp.period?.from} to ${cmp.period?.to}`);
      row('Previous period', `${cmp.previous?.from} to ${cmp.previous?.to}`);
      row('Metric', 'Current', 'Previous', 'Change %');
      for (const key of [
        'newUsers',
        'newListings',
        'newConversations',
        'purchases',
        'revenue',
      ]) {
        const d = cmp[key];
        if (d) row(key, d.current, d.previous, d.changePct);
      }
    }

    const ts = report.timeSeries as Record<string, any[]>;
    for (const [name, points] of Object.entries(ts ?? {})) {
      table(
        `Trend: ${name}`,
        ['Date', 'Count'],
        (points ?? []).map((p: any) => [p.date, p.value]),
      );
    }

    table(
      'Listings by category',
      ['Category', 'Listings'],
      (report.categoryAnalytics ?? []).map((c: any) => [
        c.categoryName,
        c.listingCount,
      ]),
    );

    const eng = report.engagement;
    table(
      'Top searches',
      ['Term', 'Count'],
      (eng?.topSearches ?? []).map((s: any) => [s.term, s.count]),
    );
    table(
      'Top viewed listings',
      ['Title', 'Views', 'Favorites'],
      (eng?.topViewedListings ?? []).map((l: any) => [
        l.title,
        l.viewCount,
        l.favoriteCount,
      ]),
    );
    table(
      'Activity breakdown',
      ['Action', 'Count'],
      (eng?.actionBreakdown ?? []).map((a: any) => [a.action, a.count]),
    );
    table(
      'Device breakdown',
      ['Device', 'Events'],
      (eng?.deviceBreakdown ?? []).map((d: any) => [d.device, d.count]),
    );
    table(
      'Login failures',
      ['Date', 'Failures'],
      (eng?.loginFailures ?? []).map((f: any) => [f.date, f.count]),
    );
    table(
      'Activity by day and hour',
      ['Day (0=Sun)', 'Hour', 'Events'],
      (eng?.weeklyActivity ?? []).map((w: any) => [w.day, w.hour, w.count]),
    );
    if (eng?.guestVsAuth) {
      table(
        'Guest vs authenticated',
        ['Action', 'Guest', 'Authenticated'],
        Object.entries(eng.guestVsAuth).map(([action, v]: [string, any]) => [
          action,
          v.guest,
          v.authenticated,
        ]),
      );
    }

    const ret = report.retention;
    pairs('Retention summary', [
      ['Retention rate %', ret?.retentionRate ?? 0],
      ['Churned users', ret?.churnedUsers ?? 0],
      [
        'Note',
        'Retention and churn compare the last 30 days against the 30 before, regardless of the range above.',
      ],
    ]);
    table(
      'Daily active users',
      ['Date', 'Active users'],
      (ret?.dailyActiveUsers ?? []).map((p: any) => [p.date, p.count]),
    );
    table(
      'Weekly active users',
      ['Week', 'Active users'],
      (ret?.weeklyActiveUsers ?? []).map((p: any) => [p.week, p.count]),
    );
    table(
      'Monthly active users',
      ['Month', 'Active users'],
      (ret?.monthlyActiveUsers ?? []).map((p: any) => [p.month, p.count]),
    );

    const rev = report.revenue;
    pairs('Revenue summary', [
      ['Total revenue', rev?.totalRevenue ?? 0],
      ['Average order value', rev?.avgOrderValue ?? 0],
    ]);
    table(
      'Revenue by payment method',
      ['Method', 'Revenue', 'Transactions'],
      (rev?.byPaymentMethod ?? []).map((r: any) => [
        r.method,
        r.revenue,
        r.count,
      ]),
    );
    table(
      'Revenue by package type',
      ['Type', 'Revenue', 'Transactions'],
      (rev?.byPackageType ?? []).map((r: any) => [r.type, r.revenue, r.count]),
    );
    table(
      'Revenue over time',
      ['Date', 'Revenue', 'Transactions'],
      (rev?.revenueTimeSeries ?? []).map((r: any) => [
        r.date,
        r.revenue,
        r.count,
      ]),
    );

    const otpData = report.otp;
    pairs('OTP summary', [
      ['Sent', otpData?.summary?.totalSent ?? 0],
      ['Verified', otpData?.summary?.totalVerified ?? 0],
      ['Failed', otpData?.summary?.totalFailed ?? 0],
      ['Success rate %', otpData?.summary?.successRate ?? 0],
    ]);
    table(
      'OTP events',
      ['Event', 'Count'],
      (otpData?.actionBreakdown ?? []).map((a: any) => [a.action, a.count]),
    );
    table(
      'OTP by channel',
      ['Channel', 'Count'],
      (otpData?.channelBreakdown ?? []).map((c: any) => [c.channel, c.count]),
    );
    if (otpData?.userVerificationStatus) {
      pairs('Account verification', [
        ['Email verified', otpData.userVerificationStatus.emailVerified],
        ['Phone verified', otpData.userVerificationStatus.phoneVerified],
        ['Not verified', otpData.userVerificationStatus.unverified],
        [
          'Note',
          'These counts overlap: a user can verify both an email and a phone.',
        ],
      ]);
    }

    const social = report.socialLogins;
    pairs('Social logins', [
      ['Total', social?.totalSocialLogins ?? 0],
      ['New users', social?.newVsReturning?.newUsers ?? 0],
      ['Returning users', social?.newVsReturning?.returningUsers ?? 0],
    ]);
    table(
      'Social logins by provider',
      ['Provider', 'Logins'],
      (social?.byProvider ?? []).map((p: any) => [p.provider, p.count]),
    );

    const traf = report.traffic;
    pairs('Traffic summary', [
      ['Sessions', traf?.summary?.sessions ?? 0],
      ['Unique visitors', traf?.summary?.uniqueVisitors ?? 0],
      ['Median events per session', traf?.summary?.medianEventsPerSession ?? 0],
      ['Median session seconds', traf?.summary?.medianDurationSeconds ?? 0],
      ['New visitors', traf?.summary?.newVisitors ?? 0],
      ['Returning visitors', traf?.summary?.returningVisitors ?? 0],
      ['Events carrying a session', traf?.coverage?.eventsWithSession ?? 0],
      ['Total events recorded', traf?.coverage?.totalEvents ?? 0],
      [
        'Note',
        'Session metrics only cover events that carry a session id, so they describe browser traffic rather than all recorded activity.',
      ],
    ]);
    table(
      'Traffic by channel',
      ['Channel', 'Sessions'],
      (traf?.byChannel ?? []).map((c: any) => [c.channel, c.sessions]),
    );
    table(
      'Top referrers',
      ['Host', 'Sessions'],
      (traf?.topReferrers ?? []).map((r: any) => [r.host, r.sessions]),
      'No external referrers recorded in this range',
    );
    table(
      'Campaigns',
      ['Source', 'Medium', 'Campaign', 'Sessions'],
      (traf?.campaigns ?? []).map((c: any) => [
        c.source,
        c.medium,
        c.campaign,
        c.sessions,
      ]),
      'No campaign-tagged traffic in this range',
    );
    table(
      'Landing pages',
      ['Path', 'Sessions'],
      (traf?.landingPages ?? []).map((p: any) => [p.path, p.sessions]),
    );
    table(
      'Sessions over time',
      ['Date', 'Sessions'],
      (traf?.sessionsTimeSeries ?? []).map((p: any) => [p.date, p.sessions]),
    );
    table(
      'Session depth',
      ['Events per session', 'Sessions'],
      (traf?.depthDistribution ?? []).map((d: any) => [d.bucket, d.sessions]),
    );
    table(
      'Sessions by browser',
      ['Browser', 'Sessions'],
      (traf?.byBrowser ?? []).map((b: any) => [b.browser, b.sessions]),
    );
    table(
      'Sessions by operating system',
      ['OS', 'Sessions'],
      (traf?.byOs ?? []).map((o: any) => [o.os, o.sessions]),
    );
    table(
      'Sessions by connection',
      ['Connection', 'Sessions'],
      (traf?.byConnection ?? []).map((c: any) => [c.connection, c.sessions]),
    );

    const funnel = report.listingFunnel;
    table(
      'Listing funnel',
      ['Stage', 'Listings', 'Share of viewed %', 'Dropped'],
      (funnel?.funnel ?? []).map((s: any) => [
        s.stage,
        s.listings,
        s.pct,
        s.dropOff ?? '',
      ]),
    );
    pairs('Listing funnel rates', [
      ['View to contact %', funnel?.conversionRates?.viewToContact ?? 0],
      [
        'Contact to conversation %',
        funnel?.conversionRates?.contactToConversation ?? 0,
      ],
      [
        'View to conversation %',
        funnel?.conversionRates?.viewToConversation ?? 0,
      ],
      ['Total views', funnel?.eventTotals?.views ?? 0],
      ['Total contacts', funnel?.eventTotals?.contacts ?? 0],
      [
        'Conversations not linked to a listing',
        funnel?.attribution?.conversationsWithoutListing ?? 0,
      ],
      [
        'Conversations on listings with no contact event',
        funnel?.attribution?.conversationsOnUncontactedListings ?? 0,
      ],
      [
        'Note',
        'The funnel counts listings, not events, and its stages are strictly nested.',
      ],
    ]);
    table(
      'Funnel by category',
      [
        'Category',
        'Listings',
        'Views',
        'Contacts',
        'Chats',
        'View to contact %',
      ],
      (funnel?.byCategory ?? []).map((c: any) => [
        c.categoryName,
        c.listings,
        c.views,
        c.contacts,
        c.conversations,
        c.viewToContact,
      ]),
    );
    table(
      'Top listings',
      ['Title', 'Views', 'Unique viewers', 'Contacts', 'Saves', 'Chats'],
      (funnel?.topListings ?? []).map((l: any) => [
        l.title,
        l.views,
        l.uniqueViewers,
        l.contacts,
        l.favorites,
        l.conversations,
      ]),
    );

    const beh = report.behaviour;
    table(
      'Top pages',
      ['Path', 'Views'],
      (beh?.topPages ?? []).map((p: any) => [p.path, p.views]),
    );
    table(
      'Page sections',
      ['Section', 'Views'],
      (beh?.pageSections ?? []).map((p: any) => [p.section, p.views]),
    );
    pairs('Filter usage', [
      ['Filter interactions', beh?.filterUsage?.applies ?? 0],
      ['With at least one filter', beh?.filterUsage?.withFilters ?? 0],
      ['Cleared filters', beh?.filterUsage?.cleared ?? 0],
      ['Filter rate %', beh?.filterUsage?.filterRate ?? 0],
    ]);
    table(
      'Most used filters',
      ['Filter', 'Uses'],
      (beh?.topFilters ?? []).map((f: any) => [f.key, f.uses]),
    );
    table(
      'Views by listing city',
      ['City', 'Views', 'Listings viewed'],
      (beh?.viewsByCity ?? []).map((c: any) => [c.city, c.views, c.listings]),
      'No city recorded on views in this range',
    );
    pairs('Package browsing', [
      ['Package lists opened', beh?.packageBrowsing?.listViewed ?? 0],
      ['Found nothing available', beh?.packageBrowsing?.noneAvailable ?? 0],
      ['Empty shelf rate %', beh?.packageBrowsing?.emptyShelfRate ?? 0],
      ['Purchase button clicks', beh?.packageBrowsing?.ctaClicked ?? 0],
      ['Payment attempts', beh?.packageBrowsing?.paymentAttempts ?? 0],
    ]);
    table(
      'Purchase outcomes',
      ['Status', 'Purchases', 'Share %', 'Value'],
      (beh?.purchaseOutcomes ?? []).map((p: any) => [
        p.status,
        p.purchases,
        p.pct,
        p.amount,
      ]),
    );

    const voice = report.voiceSearch;
    pairs('Voice search', [
      ['Started', voice?.totalStarted ?? 0],
      ['Completed', voice?.totalCompleted ?? 0],
      ['Cancelled', voice?.totalCancelled ?? 0],
      ['Errors', voice?.totalErrors ?? 0],
      ['Completion rate %', voice?.completionRate ?? 0],
      ['Text searches', voice?.searchComparison?.totalTextSearches ?? 0],
      ['Voice searches', voice?.searchComparison?.totalVoiceSearches ?? 0],
      ['Voice share %', voice?.searchComparison?.voiceSearchShare ?? 0],
    ]);
    table(
      'Voice search top queries',
      ['Term', 'Count'],
      (voice?.topQueries ?? []).map((q: any) => [q.term, q.count]),
    );

    const pt = report.priceTrends;
    pairs('Price trends summary', [
      ['Total price changes', pt?.totalPriceChanges ?? 0],
      ['Average increase', pt?.avgPriceIncrease ?? 0],
      ['Average decrease', pt?.avgPriceDecrease ?? 0],
    ]);
    table(
      'Price trends by category',
      ['Category', 'Edits', 'Avg before', 'Avg after', 'Diff %', 'Direction'],
      (pt?.categories ?? []).map((c: any) => [
        c.categoryName,
        c.totalChanges,
        c.avgPreviousPrice,
        c.avgNewPrice,
        c.avgDiffPct,
        c.direction,
      ]),
    );

    const banner = report.appBanner;
    pairs('App download banner', [
      ['Shown', banner?.shown ?? 0],
      ['Clicks', banner?.clicks ?? 0],
      ['Click rate %', banner?.clickRate ?? 0],
      ['Dismissals', banner?.dismissals ?? 0],
      ['Dismiss rate %', banner?.dismissRate ?? 0],
    ]);

    const idv = report.idVerification;
    pairs('ID verification', [
      ['Pending', idv?.pending ?? 0],
      ['Approved', idv?.approved ?? 0],
      ['Rejected', idv?.rejected ?? 0],
      ['Total', idv?.total ?? 0],
    ]);

    return lines.join('\n');
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

    if (sellerId) {
      if (Types.ObjectId.isValid(sellerId)) {
        filter.sellerId = new Types.ObjectId(sellerId);
      } else {
        // Search by transaction ID if not a valid ObjectId
        filter.paymentTransactionId = { $regex: sellerId, $options: 'i' };
      }
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const now = new Date();

    // Ad slots are credited to `listingLimit` at activation and never spent from
    // the purchase row, so summing `remainingQuantity` reported the total ever
    // bought and called it "remaining". What this figure is for is how many slots
    // the seller's current limit owes to packages, which is the granted quantity of
    // every unexpired slots purchase — bundles included, and those carry it as an
    // entitlement rather than in `type`.
    const slotPurchases = await this.packagePurchaseModel
      .find({
        sellerId: new Types.ObjectId(sellerId),
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $gt: now },
        // -1 marks a purchase whose expiry has already been reversed out.
        remainingQuantity: { $gte: 0 },
        $or: [
          { type: AdPackageType.AD_SLOTS },
          { entitlements: { $elemMatch: { kind: EntitlementKind.AD_SLOTS } } },
        ],
      })
      .exec();

    const activePackageSlots = slotPurchases.reduce(
      (sum, purchase) =>
        sum +
        (purchaseBalances(purchase).find(
          (e) => e.kind === EntitlementKind.AD_SLOTS,
        )?.quantity ?? 0),
      0,
    );
    const remainingFreeSlots = Math.max(
      0,
      user.listingLimit - user.activeListingCount,
    );

    return {
      sellerId,
      activeListingCount: user.activeListingCount,
      listingLimit: user.listingLimit,
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

  /**
   * Counts what was created in the window and in the one immediately before it.
   *
   * The preceding window is the same length and ends one millisecond before this
   * one starts, so the two never overlap and a "last 30 days" view is compared
   * against the 30 days before that rather than a calendar month.
   */
  private async getPeriodComparison(
    from: Date,
    to: Date,
  ): Promise<AnalyticsData['comparison']> {
    const span = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - span);

    const window = (start: Date, end: Date) => ({
      createdAt: { $gte: start, $lte: end },
    });
    const purchaseTotals = (start: Date, end: Date) =>
      this.packagePurchaseModel
        .aggregate([
          {
            $match: {
              paymentStatus: PaymentStatus.COMPLETED,
              ...window(start, end),
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              revenue: { $sum: '$price' },
            },
          },
        ])
        .exec();

    const [
      users,
      previousUsers,
      listings,
      previousListings,
      conversations,
      previousConversations,
      purchases,
      previousPurchases,
    ] = await Promise.all([
      this.userModel.countDocuments(window(from, to)).exec(),
      this.userModel.countDocuments(window(previousFrom, previousTo)).exec(),
      this.listingModel.countDocuments(window(from, to)).exec(),
      this.listingModel.countDocuments(window(previousFrom, previousTo)).exec(),
      this.conversationModel.countDocuments(window(from, to)).exec(),
      this.conversationModel
        .countDocuments(window(previousFrom, previousTo))
        .exec(),
      purchaseTotals(from, to),
      purchaseTotals(previousFrom, previousTo),
    ]);

    const current = purchases[0] || { count: 0, revenue: 0 };
    const prior = previousPurchases[0] || { count: 0, revenue: 0 };

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      previous: {
        from: previousFrom.toISOString(),
        to: previousTo.toISOString(),
      },
      newUsers: this.delta(users, previousUsers),
      newListings: this.delta(listings, previousListings),
      newConversations: this.delta(conversations, previousConversations),
      purchases: this.delta(current.count, prior.count),
      revenue: this.delta(current.revenue, prior.revenue),
    };
  }

  /**
   * Percentage change between two periods.
   *
   * A previous value of zero has no defined percentage change, so it reports 0
   * rather than infinity — the raw numbers are shown alongside, which is what
   * makes "0 to 5" readable without a misleading multiplier.
   */
  private delta(current: number, previous: number): PeriodDelta {
    const changePct =
      previous > 0
        ? Math.round(((current - previous) / previous) * 1000) / 10
        : 0;
    return { current, previous, changePct };
  }

  private async getTimeSeries(
    from: Date,
    to: Date,
  ): Promise<AnalyticsData['timeSeries']> {
    const dateMatch = { $gte: from, $lte: to };
    const groupByDate = {
      $dateToString: {
        format: '%Y-%m-%d',
        date: '$createdAt',
        timezone: this.timezone,
      },
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
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async findRejectionReasonById(id: string): Promise<any> {
    const reason = await this.rejectionReasonModel.findById(id).lean().exec();
    if (!reason) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return reason;
  }

  async createRejectionReason(data: {
    title: string;
    description?: string;
    isActive?: boolean;
    requiresNote?: boolean;
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
      requiresNote: boolean;
      sortOrder: number;
    }>,
  ): Promise<any> {
    const reason = await this.rejectionReasonModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!reason) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return reason;
  }

  async deleteRejectionReason(id: string): Promise<void> {
    const result = await this.rejectionReasonModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
      weeklyActivity,
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
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: this.timezone,
                },
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

      // Hourly activity distribution, bucketed in the reporting timezone rather
      // than UTC so the hours match the day being described.
      this.activityModel
        .aggregate([
          { $match: { ...dateFilter } },
          {
            $group: {
              _id: { $hour: { date: '$createdAt', timezone: this.timezone } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),

      // Same activity split by weekday as well, which is what makes a Sunday
      // evening peak distinguishable from a Tuesday morning one. Averaged over
      // the week those two cancel out and neither is visible.
      this.activityModel
        .aggregate([
          { $match: { ...dateFilter } },
          {
            $group: {
              _id: {
                day: {
                  $dayOfWeek: { date: '$createdAt', timezone: this.timezone },
                },
                hour: {
                  $hour: { date: '$createdAt', timezone: this.timezone },
                },
              },
              count: { $sum: 1 },
            },
          },
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
      // `$dayOfWeek` is 1-based from Sunday; shifted to 0-based so the client can
      // index a label array directly.
      weeklyActivity: weeklyActivity.map((w: any) => ({
        day: (w._id.day as number) - 1,
        hour: w._id.hour as number,
        count: w.count as number,
      })),
      timezone: this.timezone,
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

  // ── Voice Search Analytics ───────────────────────────────────────

  async getVoiceSearchAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    totalStarted: number;
    totalCompleted: number;
    totalCancelled: number;
    totalErrors: number;
    completionRate: number;
    cancelRate: number;
    errorRate: number;
    topQueries: { term: string; count: number }[];
    byPlatform: {
      platform: string;
      started: number;
      completed: number;
      cancelled: number;
      errors: number;
    }[];
    errorBreakdown: { error: string; count: number }[];
    dailyTrend: { date: string; started: number; completed: number }[];
    searchComparison: {
      totalTextSearches: number;
      totalVoiceSearches: number;
      voiceSearchShare: number;
      dailyComparison: { date: string; text: number; voice: number }[];
    };
  }> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const voiceActions = [
      UserAction.VOICE_SEARCH_START,
      UserAction.VOICE_SEARCH_COMPLETE,
      UserAction.VOICE_SEARCH_CANCEL,
      UserAction.VOICE_SEARCH_ERROR,
    ];

    const [
      totalStarted,
      totalCompleted,
      totalCancelled,
      totalErrors,
      topQueries,
      platformBreakdown,
      errorBreakdown,
      dailyTrend,
      totalTextSearches,
      dailySearchComparison,
    ] = await Promise.all([
      this.activityModel
        .countDocuments({
          action: UserAction.VOICE_SEARCH_START,
          ...dateFilter,
        })
        .exec(),
      this.activityModel
        .countDocuments({
          action: UserAction.VOICE_SEARCH_COMPLETE,
          ...dateFilter,
        })
        .exec(),
      this.activityModel
        .countDocuments({
          action: UserAction.VOICE_SEARCH_CANCEL,
          ...dateFilter,
        })
        .exec(),
      this.activityModel
        .countDocuments({
          action: UserAction.VOICE_SEARCH_ERROR,
          ...dateFilter,
        })
        .exec(),

      // Top voice search queries
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.VOICE_SEARCH_COMPLETE,
              searchQuery: { $ne: null },
              ...dateFilter,
            },
          },
          { $group: { _id: '$searchQuery', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ])
        .exec(),

      // Platform (mobile vs desktop) breakdown
      this.activityModel
        .aggregate([
          {
            $match: {
              action: { $in: voiceActions },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                platform: {
                  $cond: [
                    { $eq: ['$metadata.mobile', true] },
                    'mobile',
                    'desktop',
                  ],
                },
                action: '$action',
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),

      // Error type breakdown
      this.activityModel
        .aggregate([
          {
            $match: {
              action: UserAction.VOICE_SEARCH_ERROR,
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: { $ifNull: ['$metadata.error', 'unknown'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .exec(),

      // Daily trend (voice)
      this.activityModel
        .aggregate([
          {
            $match: {
              action: {
                $in: [
                  UserAction.VOICE_SEARCH_START,
                  UserAction.VOICE_SEARCH_COMPLETE,
                ],
              },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: this.timezone,
                  },
                },
                action: '$action',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ])
        .exec(),

      // Total normal text searches (action = 'search')
      this.activityModel
        .countDocuments({ action: UserAction.SEARCH, ...dateFilter })
        .exec(),

      // Daily comparison: text search vs voice search (completed)
      this.activityModel
        .aggregate([
          {
            $match: {
              action: {
                $in: [UserAction.SEARCH, UserAction.VOICE_SEARCH_COMPLETE],
              },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: this.timezone,
                  },
                },
                action: '$action',
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ])
        .exec(),
    ]);

    // Build platform breakdown map
    const platformMap = new Map<
      string,
      { started: number; completed: number; cancelled: number; errors: number }
    >();
    for (const row of platformBreakdown) {
      const platform = row._id.platform;
      if (!platformMap.has(platform)) {
        platformMap.set(platform, {
          started: 0,
          completed: 0,
          cancelled: 0,
          errors: 0,
        });
      }
      const entry = platformMap.get(platform)!;
      if (row._id.action === UserAction.VOICE_SEARCH_START)
        entry.started = row.count;
      else if (row._id.action === UserAction.VOICE_SEARCH_COMPLETE)
        entry.completed = row.count;
      else if (row._id.action === UserAction.VOICE_SEARCH_CANCEL)
        entry.cancelled = row.count;
      else if (row._id.action === UserAction.VOICE_SEARCH_ERROR)
        entry.errors = row.count;
    }

    // Build daily trend
    const dailyMap = new Map<string, { started: number; completed: number }>();
    for (const row of dailyTrend) {
      const date = row._id.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { started: 0, completed: 0 });
      }
      const entry = dailyMap.get(date)!;
      if (row._id.action === UserAction.VOICE_SEARCH_START)
        entry.started = row.count;
      else if (row._id.action === UserAction.VOICE_SEARCH_COMPLETE)
        entry.completed = row.count;
    }

    // Build daily search comparison (text vs voice)
    const comparisonMap = new Map<string, { text: number; voice: number }>();
    for (const row of dailySearchComparison) {
      const date = row._id.date;
      if (!comparisonMap.has(date)) {
        comparisonMap.set(date, { text: 0, voice: 0 });
      }
      const entry = comparisonMap.get(date)!;
      if (row._id.action === UserAction.SEARCH) entry.text = row.count;
      else if (row._id.action === UserAction.VOICE_SEARCH_COMPLETE)
        entry.voice = row.count;
    }

    const totalSearches = totalTextSearches + totalCompleted;
    const voiceSearchShare =
      totalSearches > 0
        ? Math.round((totalCompleted / totalSearches) * 10000) / 100
        : 0;

    return {
      totalStarted,
      totalCompleted,
      totalCancelled,
      totalErrors,
      completionRate:
        totalStarted > 0
          ? Math.round((totalCompleted / totalStarted) * 10000) / 100
          : 0,
      cancelRate:
        totalStarted > 0
          ? Math.round((totalCancelled / totalStarted) * 10000) / 100
          : 0,
      errorRate:
        totalStarted > 0
          ? Math.round((totalErrors / totalStarted) * 10000) / 100
          : 0,
      topQueries: topQueries.map((q: any) => ({ term: q._id, count: q.count })),
      byPlatform: Array.from(platformMap.entries()).map(
        ([platform, stats]) => ({
          platform,
          ...stats,
        }),
      ),
      errorBreakdown: errorBreakdown.map((e: any) => ({
        error: e._id,
        count: e.count,
      })),
      dailyTrend: Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        ...stats,
      })),
      searchComparison: {
        totalTextSearches,
        totalVoiceSearches: totalCompleted,
        voiceSearchShare,
        dailyComparison: Array.from(comparisonMap.entries()).map(
          ([date, stats]) => ({
            date,
            ...stats,
          }),
        ),
      },
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
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async findDeletionReasonById(id: string): Promise<any> {
    const reason = await this.deletionReasonModel.findById(id).lean().exec();
    if (!reason) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return reason;
  }

  async createDeletionReason(data: {
    title: string;
    description?: string;
    isActive?: boolean;
    requiresNote?: boolean;
    sortOrder?: number;
  }): Promise<any> {
    return await new this.deletionReasonModel(data).save();
  }

  async updateDeletionReason(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      isActive: boolean;
      requiresNote: boolean;
      sortOrder: number;
    }>,
  ): Promise<any> {
    const reason = await this.deletionReasonModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .exec();
    if (!reason) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return reason;
  }

  async deleteDeletionReason(id: string): Promise<void> {
    const result = await this.deletionReasonModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: this.timezone,
                  },
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

  // Traffic / Acquisition Analytics

  /**
   * Where visits come from and what they consist of.
   *
   * Two different denominators live in here, and conflating them would be
   * wrong. Session shape (count, depth, duration) is measured over *every*
   * event that carries a `sessionId`. Acquisition and environment (channel,
   * referrer, campaign, device, browser) are measured over `session_start`
   * events only, because that is the single event the client attaches the
   * referrer and campaign context to — repeating twenty fields on every view
   * would multiply the size of the collection.
   *
   * The `coverage` block reports both denominators so the numbers can be read
   * honestly: rows created by seed scripts carry no session at all, so session
   * metrics describe real browser traffic rather than all recorded activity.
   */
  async getTrafficAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const range = dateFilter.createdAt as
      | { $gte?: Date; $lte?: Date }
      | undefined;

    const sessionMatch = { sessionId: { $type: 'string' }, ...dateFilter };
    const startMatch = { action: UserAction.SESSION_START, ...dateFilter };

    // Strips a trailing version from a user-agent label, so a breakdown groups
    // on "Chrome" rather than one row per patch release.
    const nameOnly = (field: any) => ({
      $trim: {
        input: {
          $ifNull: [
            {
              $getField: {
                field: 'match',
                input: {
                  $regexFind: { input: field, regex: '^[A-Za-z][A-Za-z ]*' },
                },
              },
            },
            field,
          ],
        },
      },
    });

    const [sessionShape, acquisition, environment, visitorMix, coverage] =
      await Promise.all([
        // Per-session rollup first, then several views of it at once.
        this.activityModel
          .aggregate([
            { $match: sessionMatch },
            {
              $group: {
                _id: '$sessionId',
                events: { $sum: 1 },
                visitorId: { $first: '$visitorId' },
                start: { $min: '$createdAt' },
                end: { $max: '$createdAt' },
              },
            },
            {
              $facet: {
                totals: [
                  {
                    $group: {
                      _id: null,
                      sessions: { $sum: 1 },
                      events: { $sum: '$events' },
                      // Median, not mean: one tab left open all day drags an
                      // average session to a length nobody actually had.
                      medianEvents: {
                        $median: { input: '$events', method: 'approximate' },
                      },
                      medianDurationMs: {
                        $median: {
                          input: { $subtract: ['$end', '$start'] },
                          method: 'approximate',
                        },
                      },
                    },
                  },
                ],
                visitors: [{ $group: { _id: '$visitorId' } }, { $count: 'n' }],
                depth: [
                  {
                    $bucket: {
                      groupBy: '$events',
                      boundaries: [1, 2, 3, 6, 11, 21],
                      default: 21,
                      output: { sessions: { $sum: 1 } },
                    },
                  },
                ],
                perDay: [
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$start',
                          timezone: this.timezone,
                        },
                      },
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { _id: 1 } },
                ],
              },
            },
          ])
          .exec(),

        // Acquisition context, which only session_start carries.
        this.activityModel
          .aggregate([
            { $match: startMatch },
            {
              $project: {
                referrerHost: '$metadata.referrerHost',
                source: '$metadata.utm_source',
                medium: '$metadata.utm_medium',
                campaign: '$metadata.utm_campaign',
                landingPath: '$metadata.landingPath',
                paidClick: {
                  $or: [
                    { $ne: [{ $ifNull: ['$metadata.gclid', null] }, null] },
                    { $ne: [{ $ifNull: ['$metadata.fbclid', null] }, null] },
                  ],
                },
              },
            },
            {
              $addFields: {
                channel: {
                  $switch: {
                    branches: [
                      // A click id or a paid medium settles it outright.
                      { case: '$paidClick', then: 'paid' },
                      {
                        case: {
                          $in: [
                            { $toLower: { $ifNull: ['$medium', ''] } },
                            ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_social'],
                          ],
                        },
                        then: 'paid',
                      },
                      {
                        case: {
                          $eq: [
                            { $toLower: { $ifNull: ['$medium', ''] } },
                            'email',
                          ],
                        },
                        then: 'email',
                      },
                      {
                        case: {
                          $regexMatch: {
                            input: { $ifNull: ['$referrerHost', ''] },
                            regex:
                              '(^|\\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave)\\.',
                            options: 'i',
                          },
                        },
                        then: 'organic search',
                      },
                      {
                        case: {
                          $regexMatch: {
                            input: { $ifNull: ['$referrerHost', ''] },
                            regex:
                              '(^|\\.)(facebook|instagram|twitter|linkedin|pinterest|reddit|tiktok|youtube|whatsapp|snapchat)\\.',
                            options: 'i',
                          },
                        },
                        then: 'social',
                      },
                      {
                        case: { $ne: [{ $ifNull: ['$referrerHost', ''] }, ''] },
                        then: 'referral',
                      },
                      {
                        case: { $ne: [{ $ifNull: ['$source', null] }, null] },
                        then: 'campaign',
                      },
                    ],
                    // No referrer and no campaign tag: typed in, bookmarked, or
                    // arrived from somewhere that stripped the referrer.
                    default: 'direct',
                  },
                },
              },
            },
            {
              $facet: {
                byChannel: [
                  { $group: { _id: '$channel', sessions: { $sum: 1 } } },
                  { $sort: { sessions: -1 } },
                ],
                topReferrers: [
                  { $match: { referrerHost: { $type: 'string' } } },
                  { $group: { _id: '$referrerHost', sessions: { $sum: 1 } } },
                  { $sort: { sessions: -1 } },
                  { $limit: 15 },
                ],
                campaigns: [
                  { $match: { source: { $type: 'string' } } },
                  {
                    $group: {
                      _id: {
                        source: '$source',
                        medium: { $ifNull: ['$medium', '(none)'] },
                        campaign: { $ifNull: ['$campaign', '(none)'] },
                      },
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { sessions: -1 } },
                  { $limit: 20 },
                ],
                landingPages: [
                  { $match: { landingPath: { $type: 'string' } } },
                  { $group: { _id: '$landingPath', sessions: { $sum: 1 } } },
                  { $sort: { sessions: -1 } },
                  { $limit: 15 },
                ],
              },
            },
          ])
          .exec(),

        // Device and environment, per session rather than per event, so a
        // visitor who scrolls a hundred listings counts once.
        this.activityModel
          .aggregate([
            { $match: startMatch },
            {
              $facet: {
                byDevice: [
                  {
                    $group: {
                      _id: { $ifNull: ['$metadata.deviceType', 'unknown'] },
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { sessions: -1 } },
                ],
                byBrowser: [
                  {
                    $group: {
                      _id: nameOnly({
                        $ifNull: ['$metadata.browser', 'unknown'],
                      }),
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { sessions: -1 } },
                  { $limit: 12 },
                ],
                byOs: [
                  {
                    $group: {
                      _id: nameOnly({ $ifNull: ['$metadata.os', 'unknown'] }),
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { sessions: -1 } },
                  { $limit: 12 },
                ],
                byConnection: [
                  {
                    $match: { 'metadata.connectionType': { $type: 'string' } },
                  },
                  {
                    $group: {
                      _id: '$metadata.connectionType',
                      sessions: { $sum: 1 },
                    },
                  },
                  { $sort: { sessions: -1 } },
                ],
                signedIn: [
                  {
                    $group: {
                      _id: null,
                      authenticated: {
                        $sum: {
                          $cond: [
                            { $eq: ['$metadata.authenticated', true] },
                            1,
                            0,
                          ],
                        },
                      },
                      guest: {
                        $sum: {
                          $cond: [
                            { $eq: ['$metadata.authenticated', true] },
                            0,
                            1,
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          ])
          .exec(),

        // New vs returning, judged on a visitor's first event ever rather than
        // their first event in the window, otherwise everyone looks new.
        this.activityModel
          .aggregate([
            { $match: { visitorId: { $type: 'string' } } },
            {
              $group: {
                _id: '$visitorId',
                firstSeen: { $min: '$createdAt' },
                inRange: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          range?.$gte
                            ? { $gte: ['$createdAt', range.$gte] }
                            : true,
                          range?.$lte
                            ? { $lte: ['$createdAt', range.$lte] }
                            : true,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $match: { inRange: { $gt: 0 } } },
            {
              $group: {
                _id: null,
                visitors: { $sum: 1 },
                newVisitors: {
                  $sum: {
                    $cond: [
                      range?.$gte ? { $gte: ['$firstSeen', range.$gte] } : true,
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec(),

        // How much of the recorded activity carries session context at all.
        this.activityModel
          .aggregate([
            { $match: dateFilter },
            {
              $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                withSession: {
                  $sum: {
                    $cond: [{ $eq: [{ $type: '$sessionId' }, 'string'] }, 1, 0],
                  },
                },
                withVisitor: {
                  $sum: {
                    $cond: [{ $eq: [{ $type: '$visitorId' }, 'string'] }, 1, 0],
                  },
                },
                sessionStarts: {
                  $sum: {
                    $cond: [
                      { $eq: ['$action', UserAction.SESSION_START] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .exec(),
      ]);

    const shape = sessionShape[0] ?? {};
    const totals = shape.totals?.[0] ?? {};
    const sessions = totals.sessions ?? 0;
    const acq = acquisition[0] ?? {};
    const env = environment[0] ?? {};
    const mix = visitorMix[0] ?? { visitors: 0, newVisitors: 0 };
    const cov = coverage[0] ?? {};

    const DEPTH_LABELS: Record<number, string> = {
      1: '1 event',
      2: '2 events',
      3: '3-5 events',
      6: '6-10 events',
      11: '11-20 events',
      21: '21+ events',
    };

    return {
      summary: {
        sessions,
        events: totals.events ?? 0,
        uniqueVisitors: shape.visitors?.[0]?.n ?? 0,
        medianEventsPerSession: totals.medianEvents ?? 0,
        medianDurationSeconds: Math.round(
          (totals.medianDurationMs ?? 0) / 1000,
        ),
        newVisitors: mix.newVisitors ?? 0,
        returningVisitors: Math.max(
          0,
          (mix.visitors ?? 0) - (mix.newVisitors ?? 0),
        ),
        sessionsPerVisitor:
          mix.visitors > 0
            ? Math.round((sessions / mix.visitors) * 100) / 100
            : 0,
      },
      sessionsTimeSeries: (shape.perDay ?? []).map((d: any) => ({
        date: d._id,
        sessions: d.sessions,
      })),
      depthDistribution: (shape.depth ?? []).map((d: any) => ({
        bucket: DEPTH_LABELS[d._id as number] ?? String(d._id),
        sessions: d.sessions,
      })),
      byChannel: (acq.byChannel ?? []).map((c: any) => ({
        channel: c._id,
        sessions: c.sessions,
      })),
      topReferrers: (acq.topReferrers ?? []).map((r: any) => ({
        host: r._id,
        sessions: r.sessions,
      })),
      campaigns: (acq.campaigns ?? []).map((c: any) => ({
        source: c._id.source,
        medium: c._id.medium,
        campaign: c._id.campaign,
        sessions: c.sessions,
      })),
      landingPages: (acq.landingPages ?? []).map((p: any) => ({
        path: p._id,
        sessions: p.sessions,
      })),
      byDevice: (env.byDevice ?? []).map((d: any) => ({
        device: d._id,
        sessions: d.sessions,
      })),
      byBrowser: (env.byBrowser ?? []).map((b: any) => ({
        browser: b._id || 'unknown',
        sessions: b.sessions,
      })),
      byOs: (env.byOs ?? []).map((o: any) => ({
        os: o._id || 'unknown',
        sessions: o.sessions,
      })),
      byConnection: (env.byConnection ?? []).map((c: any) => ({
        connection: c._id,
        sessions: c.sessions,
      })),
      signedInSessions: {
        authenticated: env.signedIn?.[0]?.authenticated ?? 0,
        guest: env.signedIn?.[0]?.guest ?? 0,
      },
      coverage: {
        totalEvents: cov.totalEvents ?? 0,
        eventsWithSession: cov.withSession ?? 0,
        eventsWithVisitor: cov.withVisitor ?? 0,
        sessionStarts: cov.sessionStarts ?? 0,
        // A session whose opening event predates the window, or that began
        // before the client could record it, still shows up in session shape.
        sessionsWithoutStart: Math.max(0, sessions - (cov.sessionStarts ?? 0)),
      },
      timezone: this.timezone,
    };
  }

  // Listing Funnel Analytics

  /**
   * How a listing goes from being seen to being talked about.
   *
   * The unit is a LISTING, not an event: "1,000 views" says nothing about
   * whether one listing was refreshed a thousand times or a thousand listings
   * were each seen once, and it is the second that indicates a healthy
   * marketplace. Event totals are reported alongside for scale.
   *
   * The stages are STRICTLY NESTED — contacted counts only listings that were
   * also viewed, and conversation counts only listings that were viewed and
   * contacted — so a rate can never exceed 100%. Anything that skipped a stage
   * is reported in `attribution` instead of being quietly folded in, because a
   * conversation on a listing with no recorded contact is a tracking gap worth
   * seeing rather than a conversion worth claiming.
   */
  async getListingFunnelAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const conversationDateFilter = dateFilter.createdAt
      ? { createdAt: dateFilter.createdAt }
      : {};

    const FUNNEL_ACTIONS = [
      UserAction.VIEW,
      UserAction.CONTACT,
      UserAction.FAVORITE,
    ];

    const countIf = (action: UserAction) => ({
      $sum: { $cond: [{ $eq: ['$action', action] }, 1, 0] },
    });

    const [perListing, trend, attribution] = await Promise.all([
      // One pass over the funnel actions, rolled up per listing, then read
      // several ways at once. Deliberately avoids `distinct`, which would pull
      // an id array for every listing in the range back into the application.
      this.activityModel
        .aggregate([
          {
            $match: {
              action: { $in: FUNNEL_ACTIONS },
              productListingId: { $type: 'objectId' },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: '$productListingId',
              views: countIf(UserAction.VIEW),
              contacts: countIf(UserAction.CONTACT),
              favorites: countIf(UserAction.FAVORITE),
              viewers: { $addToSet: '$userId' },
            },
          },
          {
            $lookup: {
              from: 'conversations',
              let: { listingId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$productListingId', '$$listingId'] },
                    ...conversationDateFilter,
                  },
                },
                { $count: 'n' },
              ],
              as: 'convs',
            },
          },
          {
            $addFields: {
              conversations: { $ifNull: [{ $first: '$convs.n' }, 0] },
            },
          },
          {
            $lookup: {
              from: 'product_listings',
              localField: '_id',
              foreignField: '_id',
              pipeline: [{ $project: { title: 1, categoryId: 1, price: 1 } }],
              as: 'listing',
            },
          },
          { $addFields: { listing: { $first: '$listing' } } },
          {
            $facet: {
              funnel: [
                {
                  $group: {
                    _id: null,
                    // Each stage requires the ones before it, so the funnel
                    // cannot report more conversions than it had entries.
                    viewed: {
                      $sum: { $cond: [{ $gt: ['$views', 0] }, 1, 0] },
                    },
                    contacted: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $gt: ['$views', 0] },
                              { $gt: ['$contacts', 0] },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    conversed: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              { $gt: ['$views', 0] },
                              { $gt: ['$contacts', 0] },
                              { $gt: ['$conversations', 0] },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    saved: {
                      $sum: { $cond: [{ $gt: ['$favorites', 0] }, 1, 0] },
                    },
                    totalViews: { $sum: '$views' },
                    totalContacts: { $sum: '$contacts' },
                    totalFavorites: { $sum: '$favorites' },
                    totalConversations: { $sum: '$conversations' },
                  },
                },
              ],
              topListings: [
                { $sort: { views: -1, contacts: -1 } },
                { $limit: 15 },
                {
                  $project: {
                    _id: 0,
                    listingId: '$_id',
                    title: { $ifNull: ['$listing.title', '(deleted listing)'] },
                    views: 1,
                    contacts: 1,
                    favorites: 1,
                    conversations: 1,
                    // Distinct viewers, so one obsessive refresher does not
                    // make a listing look popular.
                    uniqueViewers: {
                      $size: {
                        $filter: {
                          input: '$viewers',
                          cond: { $ne: ['$$this', null] },
                        },
                      },
                    },
                  },
                },
              ],
              byCategory: [
                {
                  $group: {
                    _id: '$listing.categoryId',
                    listings: { $sum: 1 },
                    views: { $sum: '$views' },
                    contacts: { $sum: '$contacts' },
                    conversations: { $sum: '$conversations' },
                    contactedListings: {
                      $sum: { $cond: [{ $gt: ['$contacts', 0] }, 1, 0] },
                    },
                  },
                },
                { $sort: { views: -1 } },
                { $limit: 20 },
                {
                  $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    pipeline: [
                      { $project: { name: 1, parentId: 1 } },
                      // Leaf names are not unique — "Houses" exists under both
                      // Property for Sale and Property for Rent — so the parent
                      // is pulled in to tell two identical labels apart.
                      {
                        $lookup: {
                          from: 'categories',
                          localField: 'parentId',
                          foreignField: '_id',
                          pipeline: [{ $project: { name: 1 } }],
                          as: 'parent',
                        },
                      },
                      {
                        $addFields: {
                          parentName: { $first: '$parent.name' },
                        },
                      },
                    ],
                    as: 'category',
                  },
                },
                {
                  $addFields: {
                    category: { $first: '$category' },
                  },
                },
                {
                  $addFields: {
                    categoryName: {
                      $ifNull: [
                        {
                          $cond: [
                            {
                              $ne: [
                                { $ifNull: ['$category.parentName', null] },
                                null,
                              ],
                            },
                            {
                              $concat: [
                                '$category.parentName',
                                ' / ',
                                '$category.name',
                              ],
                            },
                            '$category.name',
                          ],
                        },
                        'Uncategorised',
                      ],
                    },
                  },
                },
                { $project: { category: 0 } },
              ],
            },
          },
        ])
        .exec(),

      // Daily view and contact counts, for the shape over time.
      this.activityModel
        .aggregate([
          {
            $match: {
              action: { $in: [UserAction.VIEW, UserAction.CONTACT] },
              productListingId: { $type: 'objectId' },
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: this.timezone,
                },
              },
              views: countIf(UserAction.VIEW),
              contacts: countIf(UserAction.CONTACT),
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),

      // Conversations the funnel cannot attribute, so the gap is visible
      // rather than silently widening the top of the funnel.
      this.conversationModel
        .aggregate([
          { $match: { ...conversationDateFilter } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              withoutListing: {
                $sum: {
                  $cond: [
                    { $ne: [{ $type: '$productListingId' }, 'objectId'] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec(),
    ]);

    const facet = perListing[0] ?? {};
    const f = facet.funnel?.[0] ?? {};
    const viewed = f.viewed ?? 0;
    const contacted = f.contacted ?? 0;
    const conversed = f.conversed ?? 0;
    const attr = attribution[0] ?? { total: 0, withoutListing: 0 };

    const rate = (part: number, whole: number) =>
      whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0;

    return {
      funnel: [
        {
          stage: 'Viewed',
          listings: viewed,
          pct: viewed > 0 ? 100 : 0,
          dropOff: null,
        },
        {
          stage: 'Contacted',
          listings: contacted,
          pct: rate(contacted, viewed),
          dropOff: viewed - contacted,
        },
        {
          stage: 'Conversation started',
          listings: conversed,
          pct: rate(conversed, viewed),
          dropOff: contacted - conversed,
        },
      ],
      conversionRates: {
        viewToContact: rate(contacted, viewed),
        contactToConversation: rate(conversed, contacted),
        viewToConversation: rate(conversed, viewed),
      },
      eventTotals: {
        views: f.totalViews ?? 0,
        contacts: f.totalContacts ?? 0,
        favorites: f.totalFavorites ?? 0,
        conversations: f.totalConversations ?? 0,
        // Saved is an intent signal but not a funnel stage: nobody has to save
        // a listing before contacting the seller, so nesting it would invent a
        // step that does not exist.
        savedListings: f.saved ?? 0,
      },
      trend: (trend ?? []).map((t: any) => ({
        date: t._id,
        views: t.views,
        contacts: t.contacts,
      })),
      topListings: facet.topListings ?? [],
      byCategory: (facet.byCategory ?? []).map((c: any) => ({
        categoryId: c._id ? String(c._id) : null,
        categoryName: c.categoryName,
        listings: c.listings,
        views: c.views,
        contacts: c.contacts,
        conversations: c.conversations,
        viewToContact: rate(c.contactedListings, c.listings),
      })),
      attribution: {
        conversationsInRange: attr.total ?? 0,
        conversationsWithoutListing: attr.withoutListing ?? 0,
        // Conversations attached to a listing that has no recorded contact
        // event. Usually means the chat began somewhere the contact button is
        // not the entry point.
        conversationsOnUncontactedListings: Math.max(
          0,
          (attr.total ?? 0) -
            (attr.withoutListing ?? 0) -
            (f.totalConversations ?? 0),
        ),
      },
      timezone: this.timezone,
    };
  }

  // Behaviour Analytics

  /**
   * What people do once they are on the site: which pages they land on, which
   * filters they reach for, which cities' stock they look at, and how package
   * purchases end.
   *
   * Two labelling points matter here and are deliberate.
   *
   * `viewsByCity` is the city of the LISTING being viewed, not the location of
   * the person viewing it — the city travels on the view event alongside the
   * listing title. It answers "whose stock gets attention", which is a supply
   * question, and must never be read as "where our visitors are".
   *
   * Payment outcomes come from the purchase records rather than from activity
   * events, because `payment_attempt` and `package_purchase` are declared in the
   * action enum but nothing emits them. A funnel built on those would report
   * zero for every stage and look like a collapse rather than a gap in tracking,
   * so the purchase records — which do carry a status — are used instead and the
   * missing instrumentation is reported in `tracking`.
   */
  async getBehaviourAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const [pages, filters, geography, packageBrowsing, purchases] =
      await Promise.all([
        // Pages, both exactly and grouped by first segment. The raw list shows
        // individual listings; the grouped list shows which areas of the site
        // carry the traffic, without a fragile slug-stripping regex.
        this.activityModel
          .aggregate([
            {
              $match: {
                'metadata.path': { $type: 'string' },
                ...dateFilter,
              },
            },
            {
              $facet: {
                exact: [
                  { $group: { _id: '$metadata.path', views: { $sum: 1 } } },
                  { $sort: { views: -1 } },
                  { $limit: 20 },
                ],
                sections: [
                  {
                    $addFields: {
                      section: {
                        $let: {
                          vars: {
                            parts: { $split: ['$metadata.path', '/'] },
                          },
                          in: {
                            $let: {
                              vars: {
                                first: { $arrayElemAt: ['$$parts', 1] },
                              },
                              in: {
                                $cond: [
                                  {
                                    $in: [
                                      { $ifNull: ['$$first', ''] },
                                      ['', null],
                                    ],
                                  },
                                  '/',
                                  { $concat: ['/', '$$first'] },
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  { $group: { _id: '$section', views: { $sum: 1 } } },
                  { $sort: { views: -1 } },
                  { $limit: 15 },
                ],
                total: [{ $count: 'n' }],
              },
            },
          ])
          .exec(),

        // Filter usage. `filterKeys` arrives as one comma-joined string, so it
        // has to be split before individual filters can be counted.
        this.activityModel
          .aggregate([
            { $match: { action: UserAction.FILTER_APPLY, ...dateFilter } },
            {
              $facet: {
                totals: [
                  {
                    $group: {
                      _id: null,
                      applies: { $sum: 1 },
                      // A filter_apply carrying no keys is someone clearing
                      // their filters, which is a different act from filtering.
                      withFilters: {
                        $sum: {
                          $cond: [
                            {
                              $gt: [
                                { $ifNull: ['$metadata.filterCount', 0] },
                                0,
                              ],
                            },
                            1,
                            0,
                          ],
                        },
                      },
                      cleared: {
                        $sum: {
                          $cond: [
                            {
                              $gt: [
                                { $ifNull: ['$metadata.filterCount', 0] },
                                0,
                              ],
                            },
                            0,
                            1,
                          ],
                        },
                      },
                    },
                  },
                ],
                byCount: [
                  {
                    $group: {
                      _id: { $ifNull: ['$metadata.filterCount', 0] },
                      applies: { $sum: 1 },
                    },
                  },
                  { $sort: { _id: 1 } },
                ],
                topKeys: [
                  {
                    $match: {
                      'metadata.filterKeys': { $type: 'string', $ne: '' },
                    },
                  },
                  {
                    $project: {
                      keys: { $split: ['$metadata.filterKeys', ','] },
                    },
                  },
                  { $unwind: '$keys' },
                  { $addFields: { key: { $trim: { input: '$keys' } } } },
                  { $match: { key: { $ne: '' } } },
                  { $group: { _id: '$key', uses: { $sum: 1 } } },
                  { $sort: { uses: -1 } },
                  { $limit: 20 },
                ],
              },
            },
          ])
          .exec(),

        // Views grouped by the city of the listing that was viewed.
        this.activityModel
          .aggregate([
            {
              $match: {
                action: UserAction.VIEW,
                'metadata.city': { $type: 'string' },
                ...dateFilter,
              },
            },
            {
              $group: {
                _id: '$metadata.city',
                views: { $sum: 1 },
                listings: { $addToSet: '$productListingId' },
              },
            },
            {
              $project: {
                views: 1,
                listings: { $size: '$listings' },
              },
            },
            { $sort: { views: -1 } },
            { $limit: 25 },
          ])
          .exec(),

        // Package browsing, and how often browsing found nothing to buy.
        this.activityModel
          .aggregate([
            {
              $match: {
                action: {
                  $in: [
                    UserAction.PACKAGE_LIST_VIEWED,
                    UserAction.PACKAGE_NONE_AVAILABLE,
                    UserAction.PACKAGE_PURCHASE_CTA_CLICKED,
                    UserAction.PACKAGE_PURCHASE_INITIATED,
                    UserAction.PAYMENT_ATTEMPT,
                    UserAction.PACKAGE_PURCHASE,
                  ],
                },
                ...dateFilter,
              },
            },
            { $group: { _id: '$action', events: { $sum: 1 } } },
            { $sort: { events: -1 } },
          ])
          .exec(),

        // How purchases actually ended.
        this.packagePurchaseModel
          .aggregate([
            { $match: { ...dateFilter } },
            {
              $group: {
                _id: '$paymentStatus',
                purchases: { $sum: 1 },
                // `price`, matching the rest of this service. There is no
                // `amount` field on a purchase, and summing one silently
                // yielded zero for every status.
                amount: { $sum: { $ifNull: ['$price', 0] } },
              },
            },
            { $sort: { purchases: -1 } },
          ])
          .exec(),
      ]);

    const pageFacet = pages[0] ?? {};
    const filterFacet = filters[0] ?? {};
    const filterTotals = filterFacet.totals?.[0] ?? {
      applies: 0,
      withFilters: 0,
      cleared: 0,
    };

    const browsing = new Map<string, number>(
      (packageBrowsing ?? []).map((b: any) => [b._id, b.events]),
    );
    const listViewed = browsing.get(UserAction.PACKAGE_LIST_VIEWED) ?? 0;
    const noneAvailable = browsing.get(UserAction.PACKAGE_NONE_AVAILABLE) ?? 0;

    const purchaseRows = (purchases ?? []).map((p: any) => ({
      status: p._id ?? 'unknown',
      purchases: p.purchases,
      amount: p.amount,
    }));
    const purchaseTotal = purchaseRows.reduce((sum, r) => sum + r.purchases, 0);
    const completed =
      purchaseRows.find((r) => r.status === 'completed')?.purchases ?? 0;

    const rate = (part: number, whole: number) =>
      whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0;

    return {
      topPages: (pageFacet.exact ?? []).map((p: any) => ({
        path: p._id,
        views: p.views,
      })),
      pageSections: (pageFacet.sections ?? []).map((p: any) => ({
        section: p._id,
        views: p.views,
      })),
      pageViewsTracked: pageFacet.total?.[0]?.n ?? 0,

      filterUsage: {
        applies: filterTotals.applies ?? 0,
        withFilters: filterTotals.withFilters ?? 0,
        cleared: filterTotals.cleared ?? 0,
        filterRate: rate(
          filterTotals.withFilters ?? 0,
          filterTotals.applies ?? 0,
        ),
      },
      filtersByCount: (filterFacet.byCount ?? []).map((f: any) => ({
        filterCount: f._id,
        applies: f.applies,
      })),
      topFilters: (filterFacet.topKeys ?? []).map((f: any) => ({
        key: f._id,
        uses: f.uses,
      })),

      viewsByCity: (geography ?? []).map((g: any) => ({
        city: g._id,
        views: g.views,
        listings: g.listings,
      })),

      packageBrowsing: {
        listViewed,
        noneAvailable,
        // Every browse that found an empty shelf. A high figure is a catalogue
        // problem rather than a demand problem.
        emptyShelfRate: rate(noneAvailable, listViewed),
        ctaClicked: browsing.get(UserAction.PACKAGE_PURCHASE_CTA_CLICKED) ?? 0,
        purchaseInitiated:
          browsing.get(UserAction.PACKAGE_PURCHASE_INITIATED) ?? 0,
        paymentAttempts: browsing.get(UserAction.PAYMENT_ATTEMPT) ?? 0,
        purchaseEvents: browsing.get(UserAction.PACKAGE_PURCHASE) ?? 0,
      },
      purchaseOutcomes: purchaseRows.map((r) => ({
        ...r,
        pct: rate(r.purchases, purchaseTotal),
      })),
      purchaseSummary: {
        total: purchaseTotal,
        completed,
        completionRate: rate(completed, purchaseTotal),
      },

      // Which of the funnel's intended steps are actually being recorded, so an
      // empty stage reads as missing instrumentation rather than as a collapse.
      tracking: {
        paymentAttemptEventsRecorded:
          (browsing.get(UserAction.PAYMENT_ATTEMPT) ?? 0) > 0,
        packagePurchaseEventsRecorded:
          (browsing.get(UserAction.PACKAGE_PURCHASE) ?? 0) > 0,
        purchaseCtaEventsRecorded:
          (browsing.get(UserAction.PACKAGE_PURCHASE_CTA_CLICKED) ?? 0) > 0,
      },
      timezone: this.timezone,
    };
  }

  // ── OTP / Verification Analytics ────────────────────────────────

  async getOtpAnalytics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Record<string, any>> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    const otpActions = [
      UserAction.OTP_SENT,
      UserAction.OTP_VERIFIED,
      UserAction.OTP_FAILED,
      UserAction.OTP_RESENT,
      UserAction.OTP_EXPIRED,
      UserAction.EMAIL_VERIFIED,
      UserAction.PHONE_VERIFIED,
      UserAction.WHATSAPP_OTP_SENT,
    ];

    const [actionBreakdown, channelBreakdown, timeSeries, verificationStats] =
      await Promise.all([
        this.activityModel
          .aggregate([
            { $match: { action: { $in: otpActions }, ...dateFilter } },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .exec(),

        this.activityModel
          .aggregate([
            {
              $match: {
                action: UserAction.OTP_SENT,
                'metadata.channel': { $exists: true },
                ...dateFilter,
              },
            },
            { $group: { _id: '$metadata.channel', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .exec(),

        this.activityModel
          .aggregate([
            { $match: { action: { $in: otpActions }, ...dateFilter } },
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                      timezone: this.timezone,
                    },
                  },
                  action: '$action',
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.date': 1 } },
          ])
          .exec(),

        Promise.all([
          this.userModel.countDocuments({ emailVerified: true }).exec(),
          this.userModel.countDocuments({ phoneVerified: true }).exec(),
          this.userModel
            .countDocuments({
              $or: [
                { email: { $exists: true }, emailVerified: false },
                { phone: { $exists: true }, phoneVerified: false },
              ],
            })
            .exec(),
        ]),
      ]);

    // Build time series by date
    const dateMap = new Map<string, Record<string, number>>();
    for (const row of timeSeries) {
      const date = row._id.date;
      if (!dateMap.has(date)) dateMap.set(date, {});
      dateMap.get(date)![row._id.action] = row.count;
    }

    const sent =
      actionBreakdown.find((a: any) => a._id === UserAction.OTP_SENT)?.count ||
      0;
    const verified =
      actionBreakdown.find((a: any) => a._id === UserAction.OTP_VERIFIED)
        ?.count || 0;
    const failed =
      actionBreakdown.find((a: any) => a._id === UserAction.OTP_FAILED)
        ?.count || 0;

    return {
      summary: {
        totalSent: sent,
        totalVerified: verified,
        totalFailed: failed,
        successRate: sent > 0 ? Math.round((verified / sent) * 10000) / 100 : 0,
      },
      actionBreakdown: actionBreakdown.map((a: any) => ({
        action: a._id,
        count: a.count,
      })),
      channelBreakdown: channelBreakdown.map((c: any) => ({
        channel: c._id || 'unknown',
        count: c.count,
      })),
      timeSeries: Array.from(dateMap.entries()).map(([date, actions]) => ({
        date,
        ...actions,
      })),
      userVerificationStatus: {
        emailVerified: verificationStats[0],
        phoneVerified: verificationStats[1],
        unverified: verificationStats[2],
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
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                      timezone: this.timezone,
                    },
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
                    $dateToString: {
                      format: '%Y-W%V',
                      date: '$createdAt',
                      timezone: this.timezone,
                    },
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
                    $dateToString: {
                      format: '%Y-%m',
                      date: '$createdAt',
                      timezone: this.timezone,
                    },
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
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: this.timezone,
                },
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
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: this.timezone,
                  },
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

  // ── ES sync helpers ───────────────────────────────────────────

  private syncToEs(listing: ProductListingDocument): void {
    this.searchSyncService
      .indexListing(listing)
      .catch((err) =>
        this.logger.warn(
          `Failed to sync listing ${listing._id} to ES: ${(err as Error).message}`,
        ),
      );
  }

  private removeFromEs(listingId: string): void {
    this.searchSyncService
      .removeListing(listingId)
      .catch((err) =>
        this.logger.warn(
          `Failed to remove listing ${listingId} from ES: ${(err as Error).message}`,
        ),
      );
  }
}
