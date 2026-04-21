import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
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

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivityDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
  ) {}

  async trackActivity(
    userId: string,
    action: UserAction,
    data: {
      productListingId?: string;
      searchQuery?: string;
      categoryId?: string;
      metadata?: Record<string, any>;
      ip?: string;
      userAgent?: string;
    },
  ): Promise<UserActivityDocument> {
    const activity = new this.activityModel({
      userId: new Types.ObjectId(userId),
      action,
      productListingId: data.productListingId
        ? new Types.ObjectId(data.productListingId)
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
    });
    return activity.save();
  }

  async getRecommendations(
    userId: string,
    lat?: number,
    lng?: number,
    limit: number = 20,
  ): Promise<ProductListingDocument[]> {
    const safeLimit = Math.min(Math.max(1, limit), 20);

    // Check if user has activity
    const activityCount = await this.activityModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();

    if (activityCount === 0) {
      return this.getColdStartRecommendations(lat, lng, safeLimit);
    }

    return this.getPersonalizedRecommendations(userId, safeLimit);
  }

  private async getPersonalizedRecommendations(
    userId: string,
    limit: number,
  ): Promise<ProductListingDocument[]> {
    const userObjId = new Types.ObjectId(userId);

    // Get dismissed listing IDs
    const dismissedActivities = await this.activityModel
      .find({ userId: userObjId, action: UserAction.DISMISS })
      .select('productListingId')
      .exec();
    const dismissedIds = dismissedActivities
      .filter((a) => a.productListingId)
      .map((a) => a.productListingId!);

    // Get categories the user has interacted with
    const recentActivities = await this.activityModel
      .find({
        userId: userObjId,
        action: {
          $in: [UserAction.VIEW, UserAction.FAVORITE, UserAction.CONTACT],
        },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    const categoryIds = [
      ...new Set(
        recentActivities
          .filter((a) => a.categoryId)
          .map((a) => a.categoryId!.toString()),
      ),
    ].map((id) => new Types.ObjectId(id));

    // Get viewed listing IDs to exclude already-seen items
    const viewedIds = recentActivities
      .filter((a) => a.productListingId)
      .map((a) => a.productListingId!);

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

    // Mix of featured and non-featured, sorted by relevance then randomized
    const [featured, regular] = await Promise.all([
      this.listingModel
        .find({ ...filter, isFeatured: true })
        .sort({ viewCount: -1 })
        .limit(Math.ceil(limit / 3))
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

    // Merge: featured sprinkled in, then fill with regular
    const featuredIds = new Set(featured.map((f) => f._id.toString()));
    const mixed: any[] = [];
    const regularFiltered = regular.filter(
      (r: any) => !featuredIds.has(r._id.toString()),
    );
    let fi = 0,
      ri = 0;
    while (
      mixed.length < limit &&
      (fi < featured.length || ri < regularFiltered.length)
    ) {
      // Insert a featured ad every 3rd position
      if (
        fi < featured.length &&
        (mixed.length % 3 === 0 || ri >= regularFiltered.length)
      ) {
        mixed.push(featured[fi++]);
      } else if (ri < regularFiltered.length) {
        mixed.push(regularFiltered[ri++]);
      } else break;
    }
    return mixed as ProductListingDocument[];
  }

  private async getColdStartRecommendations(
    lat?: number,
    lng?: number,
    limit: number = 20,
  ): Promise<ProductListingDocument[]> {
    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      deletedAt: { $exists: false },
    };

    // If location is available, use geo query for nearby trending
    if (lat !== undefined && lng !== undefined) {
      filter.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 25000, // 25km
        },
      };

      return this.listingModel
        .find(filter)
        .sort({ viewCount: -1, createdAt: -1 })
        .limit(limit)
        .exec();
    }

    // No location — random mix
    const [featured, regular] = await Promise.all([
      this.listingModel
        .find({ ...filter, isFeatured: true })
        .sort({ viewCount: -1 })
        .limit(Math.ceil(limit / 3))
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

    const featuredIds = new Set(featured.map((f) => f._id.toString()));
    const mixed: any[] = [];
    const regularFiltered = regular.filter(
      (r: any) => !featuredIds.has(r._id.toString()),
    );
    let fi = 0,
      ri = 0;
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
      } else break;
    }
    return mixed as ProductListingDocument[];
  }

  async dismissRecommendation(
    userId: string,
    productListingId: string,
  ): Promise<void> {
    await this.trackActivity(userId, UserAction.DISMISS, { productListingId });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateRecommendationModels(): Promise<void> {
    this.logger.log('Starting daily recommendation model update...');

    try {
      // Clean up old activity data (older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.activityModel
        .deleteMany({ createdAt: { $lt: ninetyDaysAgo } })
        .exec();

      this.logger.log(
        `Recommendation model update complete. Cleaned ${result.deletedCount} old activities.`,
      );
    } catch (error) {
      this.logger.error('Failed to update recommendation models', error);
    }
  }
}
