import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserActivity,
  UserActivityDocument,
  UserAction,
} from './schemas/user-activity.schema.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { LISTING_PUBLIC_SELECT } from '../listings/constants/index.js';

/** Max buffer size before flushing to DB */
const BUFFER_FLUSH_SIZE = 50;

/** Max time (ms) to hold buffered activities before flushing */
const BUFFER_FLUSH_INTERVAL_MS = 5_000;

@Injectable()
export class RecommendationService implements OnModuleDestroy {
  private readonly logger = new Logger(RecommendationService.name);

  /** In-memory write buffer to batch activity inserts */
  private activityBuffer: Record<string, any>[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivityDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
  ) {
    // Start periodic flush timer
    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, BUFFER_FLUSH_INTERVAL_MS);

    // Does not hold the event loop open. The HTTP server keeps the process alive
    // in normal operation, while a test worker or a shutdown that never calls
    // onModuleDestroy can still exit instead of hanging on this handle.
    this.flushTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    // Flush remaining buffered activities on shutdown
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffer();
  }

  /**
   * Buffers an activity for batch insertion.
   * High-frequency events (views, page_views, searches) are buffered.
   * Critical events (purchases, auth) are written immediately.
   */
  async trackActivity(
    userId: string | undefined,
    action: UserAction,
    data: {
      productListingId?: string;
      shortVideoId?: string;
      searchQuery?: string;
      categoryId?: string;
      metadata?: Record<string, any>;
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      visitorId?: string;
    },
  ): Promise<UserActivityDocument> {
    const doc: Record<string, any> = {
      userId: userId ? new Types.ObjectId(userId) : undefined,
      action,
      productListingId: data.productListingId
        ? new Types.ObjectId(data.productListingId)
        : undefined,
      shortVideoId:
        data.shortVideoId && Types.ObjectId.isValid(data.shortVideoId)
          ? new Types.ObjectId(data.shortVideoId)
          : undefined,
      searchQuery: data.searchQuery,
      categoryId: data.categoryId
        ? new Types.ObjectId(data.categoryId)
        : undefined,
      metadata: data.metadata
        ? new Map(Object.entries(data.metadata))
        : new Map(),
      ip: data.ip,
      userAgent: data.userAgent,
      sessionId: data.sessionId,
      visitorId: data.visitorId,
      createdAt: new Date(),
    };

    // Critical actions bypass buffer for immediate consistency
    if (this.isCriticalAction(action)) {
      const activity = new this.activityModel(doc);
      return activity.save();
    }

    // Buffer high-frequency actions for batch insert
    this.activityBuffer.push(doc);
    if (this.activityBuffer.length >= BUFFER_FLUSH_SIZE) {
      await this.flushBuffer();
    }

    return doc as any;
  }

  /**
   * Flush buffered activities to MongoDB in a single bulk insert.
   * Uses unordered insertMany for best throughput.
   */
  private async flushBuffer(): Promise<void> {
    if (this.activityBuffer.length === 0) return;

    const batch = this.activityBuffer.splice(0);
    try {
      await this.activityModel.insertMany(batch, { ordered: false });
    } catch (error) {
      this.logger.error(
        `Failed to flush ${batch.length} buffered activities`,
        error,
      );
      // Re-queue failed items (up to a limit to prevent memory leak)
      if (this.activityBuffer.length < BUFFER_FLUSH_SIZE * 3) {
        this.activityBuffer.unshift(...batch);
      }
    }
  }

  /**
   * Critical actions that must be written immediately (auth, payments, admin).
   */
  private isCriticalAction(action: UserAction): boolean {
    return (
      action.startsWith('admin_') ||
      action.startsWith('package_purchase') ||
      action === UserAction.LOGIN ||
      action === UserAction.REGISTER ||
      action === UserAction.PAYMENT_ATTEMPT ||
      action === UserAction.LISTING_CREATE ||
      action === UserAction.LISTING_DELETE
    );
  }

  async getRecommendations(
    userId: string | undefined,
    limit: number = 20,
  ): Promise<ProductListingDocument[]> {
    const safeLimit = Math.min(Math.max(1, limit), 20);

    if (!userId) {
      return this.getColdStartRecommendations(safeLimit);
    }

    // Use a fast existence check instead of full countDocuments
    const hasActivity = await this.activityModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('_id')
      .lean()
      .exec();

    if (!hasActivity) {
      return this.getColdStartRecommendations(safeLimit);
    }

    return this.getPersonalizedRecommendations(userId, safeLimit);
  }

  private async getPersonalizedRecommendations(
    userId: string,
    limit: number,
  ): Promise<ProductListingDocument[]> {
    const userObjId = new Types.ObjectId(userId);

    // Single aggregation to get dismissed IDs + category preferences
    const [userContext] = await this.activityModel
      .aggregate([
        {
          $match: {
            userId: userObjId,
            action: {
              $in: [
                UserAction.VIEW,
                UserAction.FAVORITE,
                UserAction.CONTACT,
                UserAction.DISMISS,
              ],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $facet: {
            dismissed: [
              { $match: { action: UserAction.DISMISS } },
              { $project: { productListingId: 1 } },
            ],
            interactions: [
              {
                $match: {
                  action: { $ne: UserAction.DISMISS },
                },
              },
              { $limit: 50 },
              {
                $project: {
                  categoryId: 1,
                  productListingId: 1,
                },
              },
            ],
          },
        },
      ])
      .exec();

    const dismissedIds = (userContext?.dismissed || [])
      .filter((a: any) => a.productListingId)
      .map((a: any) => a.productListingId);

    const interactions = userContext?.interactions || [];
    const categoryIds = [
      ...new Set(
        interactions
          .filter((a: any) => a.categoryId)
          .map((a: any) => a.categoryId.toString()),
      ),
    ].map((id) => new Types.ObjectId(id as string));

    const viewedIds = interactions
      .filter((a: any) => a.productListingId)
      .map((a: any) => a.productListingId);

    const excludeIds = [...dismissedIds, ...viewedIds];

    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      deletedAt: { $exists: false },
    };

    if (excludeIds.length > 0) {
      filter._id = { $nin: excludeIds };
    }

    if (categoryIds.length > 0) {
      filter.categoryId = { $in: categoryIds };
    }

    return this.getMixedListings(filter, limit);
  }

  private async getColdStartRecommendations(
    limit: number,
  ): Promise<ProductListingDocument[]> {
    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      deletedAt: { $exists: false },
    };

    return this.getMixedListings(filter, limit);
  }

  /**
   * Shared logic: mix featured (every 3rd slot) + random regular listings.
   * Eliminates duplicated code between personalized and cold-start paths.
   */
  private async getMixedListings(
    filter: Record<string, any>,
    limit: number,
  ): Promise<ProductListingDocument[]> {
    const [featured, regular] = await Promise.all([
      this.listingModel
        .find({ ...filter, isFeatured: true })
        .select(LISTING_PUBLIC_SELECT)
        .sort({ viewCount: -1 })
        .limit(Math.ceil(limit / 3))
        .lean()
        .exec(),
      this.listingModel
        .aggregate([
          {
            $match: {
              ...filter,
              $or: [{ isFeatured: false }, { isFeatured: { $exists: false } }],
            },
          },
          { $sample: { size: limit } },
        ])
        .exec(),
    ]);

    const featuredIds = new Set(featured.map((f: any) => f._id.toString()));
    const regularFiltered = regular.filter(
      (r: any) => !featuredIds.has(r._id.toString()),
    );

    // Interleave: featured every 3rd position
    const mixed: any[] = [];
    let fi = 0;
    let ri = 0;
    while (
      mixed.length < limit &&
      (fi < featured.length || ri < regularFiltered.length)
    ) {
      if (
        fi < featured.length &&
        (mixed.length % 3 === 0 || ri >= regularFiltered.length)
      ) {
        mixed.push(featured[fi++]);
      } else if (ri < regularFiltered.length) {
        mixed.push(regularFiltered[ri++]);
      } else {
        break;
      }
    }

    return mixed as ProductListingDocument[];
  }

  async dismissRecommendation(
    userId: string,
    productListingId: string,
  ): Promise<void> {
    await this.trackActivity(userId, UserAction.DISMISS, { productListingId });
  }
}
