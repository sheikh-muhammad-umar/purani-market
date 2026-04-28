import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from './schemas/product-listing.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentStatus,
} from '../packages/schemas/package-purchase.schema.js';
import {
  AdPackageDocument,
  AdPackageType,
} from '../packages/schemas/ad-package.schema.js';
import {
  Favorite,
  FavoriteDocument,
} from '../favorites/schemas/favorite.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import {
  LISTING_ACTIVE_DAYS,
  LISTING_DEACTIVATED_CLEANUP_DAYS,
  LISTING_EXPIRY_REMINDER_DAYS,
  PACKAGE_EXPIRY_REMINDER_DAYS,
  FEATURED_EXPIRY_REMINDER_DAYS,
  STALE_PENDING_PAYMENT_HOURS,
  STALE_RESERVED_DAYS,
  DEFAULT_AD_LIMIT,
  MAX_REJECTION_COUNT,
  STALE_PENDING_REVIEW_DAYS,
  DELETION_REASON_INACTIVE_CLEANUP,
  DELETION_REASON_MAX_REJECTIONS,
} from '../common/constants/index.js';

@Injectable()
export class ListingLifecycleService {
  private readonly logger = new Logger(ListingLifecycleService.name);
  private readonly activeDays: number;
  private readonly deactivatedCleanupDays: number;
  private readonly defaultAdLimit: number;

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PackagePurchase.name)
    private readonly packagePurchaseModel: Model<PackagePurchaseDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly adminTrackerService: AdminTrackerService,
    private readonly searchSyncService: SearchSyncService,
    private readonly configService: ConfigService,
  ) {
    this.activeDays =
      this.configService.get<number>('listing.activeDays') ??
      LISTING_ACTIVE_DAYS;
    this.deactivatedCleanupDays =
      this.configService.get<number>('listing.deactivatedCleanupDays') ??
      LISTING_DEACTIVATED_CLEANUP_DAYS;
    this.defaultAdLimit =
      this.configService.get<number>('listing.defaultAdLimit') ??
      DEFAULT_AD_LIMIT;
  }

  // ─── 1. Expire active listings after 30 days (no package) ───

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredListings(): Promise<number> {
    const now = new Date();
    const expiredListings = await this.listingModel
      .find({
        status: ListingStatus.ACTIVE,
        expiresAt: { $lte: now },
      })
      .select('_id sellerId title purchaseId')
      .exec();

    if (expiredListings.length === 0) return 0;

    const listingIds = expiredListings.map((l) => l._id);

    // Bulk update to EXPIRED
    const result = await this.listingModel.updateMany(
      { _id: { $in: listingIds } },
      { $set: { status: ListingStatus.EXPIRED, updatedAt: now } },
    );

    // Decrement activeAdCount for each seller and send notifications
    const sellerDecrements = new Map<string, number>();
    for (const listing of expiredListings) {
      const sid = listing.sellerId.toString();
      sellerDecrements.set(sid, (sellerDecrements.get(sid) ?? 0) + 1);

      // Notify seller
      this.notificationsService
        .sendListingExpiredNotification(
          sid,
          listing.title,
          listing._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send expiry notification for ${listing._id}: ${(err as Error).message}`,
          ),
        );

      // Track event
      this.adminTrackerService
        .track(sid, UserAction.LISTING_EXPIRED, {
          listingId: listing._id.toString(),
          hadPackage: !!listing.purchaseId,
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to track LISTING_EXPIRED: ${(err as Error).message}`,
          ),
        );

      // Remove from search index
      this.removeFromEs(listing._id.toString());
    }

    // Batch decrement activeAdCount per seller
    for (const [sellerId, count] of sellerDecrements) {
      await this.userModel
        .updateOne(
          { _id: new Types.ObjectId(sellerId) },
          { $inc: { activeAdCount: -count } },
        )
        .exec();
    }

    this.logger.log(`Expired ${result.modifiedCount} listings`);
    return result.modifiedCount;
  }

  // ─── 2. Cleanup deactivated listings after 7 days ───

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleStaleDeactivatedListings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.deactivatedCleanupDays * 24 * 60 * 60 * 1000,
    );
    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.INACTIVE,
        deactivatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const listingIds = staleListings.map((l) => l._id);
    const now = new Date();

    const result = await this.listingModel.updateMany(
      { _id: { $in: listingIds } },
      {
        $set: {
          status: ListingStatus.DELETED,
          deletedAt: now,
          deletionReason: DELETION_REASON_INACTIVE_CLEANUP,
          updatedAt: now,
        },
      },
    );

    for (const listing of staleListings) {
      const sid = listing.sellerId.toString();

      this.notificationsService
        .sendDeactivatedListingCleanupNotification(
          sid,
          listing.title,
          listing._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send cleanup notification: ${(err as Error).message}`,
          ),
        );

      this.adminTrackerService
        .track(sid, UserAction.LISTING_DEACTIVATED_CLEANUP, {
          listingId: listing._id.toString(),
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to track LISTING_DEACTIVATED_CLEANUP: ${(err as Error).message}`,
          ),
        );

      this.removeFromEs(listing._id.toString());
    }

    this.logger.log(
      `Cleaned up ${result.modifiedCount} stale deactivated listings`,
    );
    return result.modifiedCount;
  }

  // ─── 3. Send listing expiration reminders (3 days, 1 day before) ───

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendListingExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of LISTING_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(
        now.getTime() + (days - 1) * 24 * 60 * 60 * 1000,
      );
      const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const listings = await this.listingModel
        .find({
          status: ListingStatus.ACTIVE,
          expiresAt: { $gt: windowStart, $lte: windowEnd },
        })
        .select('_id sellerId title')
        .exec();

      for (const listing of listings) {
        await this.notificationsService
          .sendListingExpirationReminder(
            listing.sellerId.toString(),
            listing.title,
            listing._id.toString(),
            days,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send listing expiry reminder: ${(err as Error).message}`,
            ),
          );
        sent++;
      }
    }

    this.logger.log(`Sent ${sent} listing expiry reminders`);
    return sent;
  }

  // ─── 4. Send featured ad expiration reminders ───

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendFeaturedExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of FEATURED_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(
        now.getTime() + (days - 1) * 24 * 60 * 60 * 1000,
      );
      const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const listings = await this.listingModel
        .find({
          isFeatured: true,
          featuredUntil: { $gt: windowStart, $lte: windowEnd },
        })
        .select('_id sellerId title')
        .exec();

      for (const listing of listings) {
        await this.notificationsService
          .sendFeaturedAdExpirationReminder(
            listing.sellerId.toString(),
            listing.title,
            listing._id.toString(),
            days,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send featured expiry reminder: ${(err as Error).message}`,
            ),
          );
        sent++;
      }
    }

    this.logger.log(`Sent ${sent} featured ad expiry reminders`);
    return sent;
  }

  // ─── 5. Send package expiration reminders (unused slots about to expire) ───

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendPackageExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of PACKAGE_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(
        now.getTime() + (days - 1) * 24 * 60 * 60 * 1000,
      );
      const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const purchases = await this.packagePurchaseModel
        .find({
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: { $gt: 0 },
          expiresAt: { $gt: windowStart, $lte: windowEnd },
        })
        .populate('packageId', 'name type')
        .exec();

      for (const purchase of purchases) {
        const pkg = purchase.packageId as unknown as AdPackageDocument;
        await this.notificationsService
          .sendPackageExpirationReminder(
            purchase.sellerId.toString(),
            pkg?.name ?? 'Ad package',
            purchase.remainingQuantity,
            days,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send package expiry reminder: ${(err as Error).message}`,
            ),
          );
        sent++;
      }
    }

    this.logger.log(`Sent ${sent} package expiry reminders`);
    return sent;
  }

  // ─── 6. Handle expired AD_SLOTS packages — reduce seller adLimit ───

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiredAdSlotPackages(): Promise<number> {
    const now = new Date();

    // Find expired AD_SLOTS purchases not yet processed (remainingQuantity >= 0).
    // After processing, we mark them with remainingQuantity = -1 to prevent re-processing.
    const expiredPurchases = await this.packagePurchaseModel
      .find({
        type: AdPackageType.AD_SLOTS,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $lte: now },
        remainingQuantity: { $gte: 0 }, // not yet processed
      })
      .populate('packageId', 'name quantity')
      .exec();

    let processed = 0;

    for (const purchase of expiredPurchases) {
      const pkg = purchase.packageId as unknown as AdPackageDocument;
      const slotsToRemove = pkg?.quantity ?? purchase.quantity;

      // Reduce seller's adLimit (floor at default 10)
      const seller = await this.userModel
        .findById(purchase.sellerId)
        .select('adLimit activeAdCount')
        .exec();

      if (seller) {
        const newLimit = Math.max(
          this.defaultAdLimit,
          seller.adLimit - slotsToRemove,
        );
        await this.userModel
          .updateOne(
            { _id: purchase.sellerId },
            { $set: { adLimit: newLimit } },
          )
          .exec();

        this.notificationsService
          .sendAdSlotsExpiredNotification(
            purchase.sellerId.toString(),
            pkg?.name ?? 'Ad slots package',
            slotsToRemove,
            newLimit,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send ad slots expiry notification: ${(err as Error).message}`,
            ),
          );

        this.adminTrackerService
          .track(
            purchase.sellerId.toString(),
            UserAction.AD_SLOTS_PACKAGE_EXPIRED,
            {
              purchaseId: purchase._id.toString(),
              slotsRemoved: slotsToRemove,
              previousAdLimit: seller.adLimit,
              newAdLimit: newLimit,
              activeAdCount: seller.activeAdCount,
            },
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to track AD_SLOTS_PACKAGE_EXPIRED: ${(err as Error).message}`,
            ),
          );
      }

      // Mark as processed by setting remainingQuantity to -1
      await this.packagePurchaseModel
        .updateOne({ _id: purchase._id }, { $set: { remainingQuantity: -1 } })
        .exec();

      processed++;
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} expired AD_SLOTS packages`);
    }
    return processed;
  }

  // ─── 7. Fail stale pending payments (>24h) ───

  @Cron(CronExpression.EVERY_HOUR)
  async handleStalePendingPayments(): Promise<number> {
    const cutoff = new Date(
      Date.now() - STALE_PENDING_PAYMENT_HOURS * 60 * 60 * 1000,
    );

    const stalePurchases = await this.packagePurchaseModel
      .find({
        paymentStatus: PaymentStatus.PENDING,
        createdAt: { $lte: cutoff },
      })
      .select('_id sellerId')
      .exec();

    if (stalePurchases.length === 0) return 0;

    const ids = stalePurchases.map((p) => p._id);
    const result = await this.packagePurchaseModel.updateMany(
      { _id: { $in: ids } },
      { $set: { paymentStatus: PaymentStatus.FAILED } },
    );

    for (const purchase of stalePurchases) {
      this.adminTrackerService
        .track(purchase.sellerId.toString(), UserAction.STALE_PAYMENT_FAILED, {
          purchaseId: purchase._id.toString(),
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to track STALE_PAYMENT_FAILED: ${(err as Error).message}`,
          ),
        );

      this.notificationsService
        .sendStalePaymentFailedNotification(
          purchase.sellerId.toString(),
          purchase._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send stale payment notification: ${(err as Error).message}`,
          ),
        );
    }

    this.logger.log(
      `Marked ${result.modifiedCount} stale pending payments as failed`,
    );
    return result.modifiedCount;
  }

  // ─── 8. Cleanup max-rejected listings (3 rejections, no resubmission in 30 days) ───

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleStaleRejectedListings(): Promise<number> {
    const cutoff = new Date(Date.now() - this.activeDays * 24 * 60 * 60 * 1000);

    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.REJECTED,
        rejectionCount: { $gte: MAX_REJECTION_COUNT },
        updatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const ids = staleListings.map((l) => l._id);
    const now = new Date();

    const result = await this.listingModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: ListingStatus.DELETED,
          deletedAt: now,
          deletionReason: DELETION_REASON_MAX_REJECTIONS,
          updatedAt: now,
        },
      },
    );

    for (const listing of staleListings) {
      this.notificationsService
        .sendRejectedListingCleanupNotification(
          listing.sellerId.toString(),
          listing.title,
          listing._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send rejected cleanup notification: ${(err as Error).message}`,
          ),
        );

      this.removeFromEs(listing._id.toString());
    }

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Cleaned up ${result.modifiedCount} max-rejected listings`,
      );
    }
    return result.modifiedCount;
  }

  // ─── 9. Auto-revert stale reserved listings (>14 days) ───

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleStaleReservedListings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - STALE_RESERVED_DAYS * 24 * 60 * 60 * 1000,
    );
    const newExpiresAt = new Date(
      Date.now() + this.activeDays * 24 * 60 * 60 * 1000,
    );

    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.RESERVED,
        updatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const ids = staleListings.map((l) => l._id);
    const result = await this.listingModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: ListingStatus.ACTIVE,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        },
      },
    );

    for (const listing of staleListings) {
      this.notificationsService
        .sendReservedListingRevertedNotification(
          listing.sellerId.toString(),
          listing.title,
          listing._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send reserved revert notification: ${(err as Error).message}`,
          ),
        );
    }

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Reverted ${result.modifiedCount} stale reserved listings to active`,
      );
    }
    return result.modifiedCount;
  }

  // ─── 10. Auto-approve stale PENDING_REVIEW listings ───

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async handleStalePendingReviewListings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - STALE_PENDING_REVIEW_DAYS * 24 * 60 * 60 * 1000,
    );

    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.PENDING_REVIEW,
        updatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const now = new Date();
    const newExpiresAt = new Date(
      now.getTime() + this.activeDays * 24 * 60 * 60 * 1000,
    );

    const ids = staleListings.map((l) => l._id);
    const result = await this.listingModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: ListingStatus.ACTIVE,
          expiresAt: newExpiresAt,
          updatedAt: now,
        },
      },
    );

    for (const listing of staleListings) {
      this.notificationsService
        .sendListingAutoApprovedNotification(
          listing.sellerId.toString(),
          listing.title,
          listing._id.toString(),
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send auto-approve notification: ${(err as Error).message}`,
          ),
        );
    }

    this.logger.log(
      `Auto-approved ${result.modifiedCount} stale pending review listings`,
    );
    return result.modifiedCount;
  }

  // ─── 11. Cleanup orphaned favorites for deleted/expired listings ───

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOrphanedFavorites(): Promise<number> {
    const deletedListingIds = await this.listingModel
      .find({
        status: { $in: [ListingStatus.DELETED, ListingStatus.EXPIRED] },
      })
      .distinct('_id')
      .exec();

    if (deletedListingIds.length === 0) return 0;

    const result = await this.favoriteModel.deleteMany({
      productListingId: { $in: deletedListingIds },
    });

    if (result.deletedCount > 0) {
      this.logger.log(`Cleaned up ${result.deletedCount} orphaned favorites`);
    }
    return result.deletedCount;
  }

  // ─── 12. Guard activeAdCount consistency (floor at 0) ───

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async fixNegativeActiveAdCounts(): Promise<number> {
    const result = await this.userModel.updateMany(
      { activeAdCount: { $lt: 0 } },
      { $set: { activeAdCount: 0 } },
    );

    if (result.modifiedCount > 0) {
      this.logger.warn(
        `Fixed ${result.modifiedCount} users with negative activeAdCount`,
      );
    }
    return result.modifiedCount;
  }

  // ─── Helpers ───

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
