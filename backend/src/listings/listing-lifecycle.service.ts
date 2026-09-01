import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
import { EntitlementKind, purchaseBalances } from '../packages/entitlements.js';
import { PackagesService } from '../packages/packages.service.js';
import {
  Favorite,
  FavoriteDocument,
} from '../favorites/schemas/favorite.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import {
  CRON_TIMEZONE,
  LISTING_EXPIRY_REMINDER_DAYS,
  LISTING_LIMIT_GRACE_DAYS,
  PACKAGE_EXPIRY_REMINDER_DAYS,
  FEATURED_EXPIRY_REMINDER_DAYS,
  STALE_PENDING_PAYMENT_HOURS,
  STALE_RESERVED_DAYS,
  MAX_REJECTION_COUNT,
  STALE_PENDING_REVIEW_DAYS,
  DELETION_REASON_INACTIVE_CLEANUP,
  DELETION_REASON_MAX_REJECTIONS,
} from '../common/constants/index.js';
import { daysToMs } from '../common/utils/time.js';

@Injectable()
export class ListingLifecycleService {
  private readonly logger = new Logger(ListingLifecycleService.name);
  private readonly activeDays: number;
  private readonly deactivatedCleanupDays: number;
  private readonly defaultListingLimit: number;

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
    @Inject(forwardRef(() => PackagesService))
    private readonly packagesService: PackagesService,
  ) {
    this.activeDays = this.configService.get<number>('listing.activeDays')!;
    this.deactivatedCleanupDays = this.configService.get<number>(
      'listing.deactivatedCleanupDays',
    )!;
    this.defaultListingLimit = this.configService.get<number>(
      'listing.defaultListingLimit',
    )!;
  }

  // ─── 1. Expire active listings after 30 days (no package) ───

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: CRON_TIMEZONE })
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

    // Decrement activeListingCount for each seller and send notifications
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

    // Batch decrement activeListingCount per seller
    for (const [sellerId, count] of sellerDecrements) {
      await this.userModel
        .updateOne(
          { _id: new Types.ObjectId(sellerId) },
          { $inc: { activeListingCount: -count } },
        )
        .exec();
    }

    this.logger.log(`Expired ${result.modifiedCount} listings`);
    return result.modifiedCount;
  }

  // ─── 2. Cleanup deactivated listings after 7 days ───

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: CRON_TIMEZONE })
  async handleStaleDeactivatedListings(): Promise<number> {
    const cutoff = new Date(Date.now() - daysToMs(this.deactivatedCleanupDays));
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

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: CRON_TIMEZONE })
  async sendListingExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of LISTING_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + daysToMs(days - 1));
      const windowEnd = new Date(now.getTime() + daysToMs(days));

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

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: CRON_TIMEZONE })
  async sendFeaturedExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of FEATURED_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + daysToMs(days - 1));
      const windowEnd = new Date(now.getTime() + daysToMs(days));

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

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: CRON_TIMEZONE })
  async sendPackageExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of PACKAGE_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + daysToMs(days - 1));
      const windowEnd = new Date(now.getTime() + daysToMs(days));

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

  // ─── 6. Handle expired AD_SLOTS packages — reduce seller listingLimit ───

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { timeZone: CRON_TIMEZONE })
  async handleExpiredAdSlotPackages(): Promise<number> {
    const now = new Date();

    // Find expired AD_SLOTS purchases not yet processed (remainingQuantity >= 0).
    // After processing, we mark them with remainingQuantity = -1 to prevent re-processing.
    const expiredPurchases = await this.packagePurchaseModel
      .find({
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $lte: now },
        remainingQuantity: { $gte: 0 }, // not yet processed
        // A bundle carries its slots as an entitlement rather than in `type`, so
        // matching on the type alone would leave bundle slots credited forever.
        $or: [
          { type: AdPackageType.AD_SLOTS },
          {
            entitlements: {
              $elemMatch: { kind: EntitlementKind.AD_SLOTS },
            },
          },
        ],
      })
      .populate('packageId', 'name quantity')
      .exec();

    let processed = 0;

    for (const purchase of expiredPurchases) {
      const pkg = purchase.packageId as unknown as AdPackageDocument;

      // Read from the purchase's own snapshot, never the live package. Reading
      // `pkg.quantity` meant an admin editing a package's quantity retroactively
      // changed how many slots were clawed back from people who bought the old one.
      const slotsToRemove = purchaseBalances(purchase).find(
        (e) => e.kind === EntitlementKind.AD_SLOTS,
      )?.quantity;

      if (!slotsToRemove || slotsToRemove <= 0) {
        await this.packagePurchaseModel
          .updateOne({ _id: purchase._id }, { $set: { remainingQuantity: -1 } })
          .exec();
        continue;
      }

      const seller = await this.userModel
        .findById(purchase.sellerId)
        .select('listingLimit activeListingCount')
        .exec();

      if (seller) {
        // Recomputed from the base allowance plus whatever packages are still
        // active, rather than subtracting this package's snapshot. The old
        // arithmetic — `max(default, limit - snapshot)` — went wrong three ways:
        // it raised the limit when an admin had lowered it below the package
        // size, it under-clawed when two packages lapsed in the same run, and it
        // silently absorbed a goodwill grant. This purchase has already expired,
        // so it drops out of the sum on its own.
        const newLimit = await this.packagesService.reconcileListingLimit(
          purchase.sellerId.toString(),
        );

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
              previousListingLimit: seller.listingLimit,
              newListingLimit: newLimit,
              activeListingCount: seller.activeListingCount,
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

  // ─── 6b. Reconcile sellers holding more live listings than their limit ───

  /**
   * Brings sellers back within their listing limit, warning before acting.
   *
   * Ad slots expire under listings that are still running, so a seller can end up
   * over their limit through nothing they did. Two bad options were available:
   * leave them over it for ever, which makes the limit meaningless and unfair to
   * everyone who pays for slots, or pull ads the instant it drops, which takes a
   * shopfront down with no warning.
   *
   * So: on first detection they are told how many are over and how long they have.
   * During the grace period they can deactivate their own choice or buy more slots
   * — either resolves it, since the limit is recomputed from active packages. Only
   * after the grace period does this deactivate for them.
   *
   * When it does act:
   * - Featured listings are never touched. That promotion was paid for and is
   *   still running.
   * - Oldest first, since they have had the most exposure already.
   * - Deactivated, not deleted, so the seller can bring them back.
   *
   * Runs after the slot-expiry cron so the day's limit changes are already in.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: CRON_TIMEZONE })
  async enforceListingLimits(): Promise<number> {
    const now = new Date();
    const graceCutoff = new Date(
      now.getTime() - daysToMs(LISTING_LIMIT_GRACE_DAYS),
    );

    const overLimit = await this.userModel
      .find({ $expr: { $gt: ['$activeListingCount', '$listingLimit'] } })
      .select('_id activeListingCount listingLimit overLimitSince')
      .exec();

    // Clear the marker for anyone who has since come back within their limit,
    // so a later breach starts its own grace period rather than inheriting an
    // expired one.
    await this.userModel
      .updateMany(
        {
          overLimitSince: { $ne: null },
          $expr: { $lte: ['$activeListingCount', '$listingLimit'] },
        },
        { $set: { overLimitSince: null } },
      )
      .exec();

    let deactivated = 0;

    for (const seller of overLimit) {
      const sellerId = seller._id.toString();
      const excess = seller.activeListingCount - seller.listingLimit;

      if (!seller.overLimitSince) {
        await this.userModel
          .updateOne({ _id: seller._id }, { $set: { overLimitSince: now } })
          .exec();

        this.notificationsService
          .sendListingLimitExceededWarning(
            sellerId,
            seller.activeListingCount,
            seller.listingLimit,
            LISTING_LIMIT_GRACE_DAYS,
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send over-limit warning: ${(err as Error).message}`,
            ),
          );

        this.adminTrackerService
          .track(sellerId, UserAction.LISTING_LIMIT_EXCEEDED, {
            activeListingCount: seller.activeListingCount,
            listingLimit: seller.listingLimit,
            excess,
          })
          .catch(() => undefined);
        continue;
      }

      if (seller.overLimitSince > graceCutoff) {
        // Still inside the grace period — leave them to it.
        continue;
      }

      // Grace is up. Take the oldest non-featured listings, keeping paid
      // promotion running.
      const candidates = await this.listingModel
        .find({
          sellerId: seller._id,
          status: ListingStatus.ACTIVE,
          $or: [{ isFeatured: false }, { isFeatured: { $exists: false } }],
        })
        .sort({ createdAt: 1 })
        .limit(excess)
        .select('_id title')
        .exec();

      if (candidates.length === 0) {
        // Everything they hold is featured, so there is nothing safe to drop.
        // Left as-is; it resolves when that promotion ends.
        this.logger.warn(
          `Seller ${sellerId} is ${excess} over their limit but holds only featured listings`,
        );
        continue;
      }

      const ids = candidates.map((l) => l._id);
      await this.listingModel
        .updateMany(
          { _id: { $in: ids } },
          {
            $set: {
              status: ListingStatus.INACTIVE,
              deactivatedAt: now,
              updatedAt: now,
            },
          },
        )
        .exec();

      await this.userModel
        .updateOne(
          { _id: seller._id },
          {
            $inc: { activeListingCount: -candidates.length },
            $set: { overLimitSince: null },
          },
        )
        .exec();

      for (const listing of candidates) {
        this.removeFromEs(listing._id.toString());
      }

      this.notificationsService
        .sendListingsDeactivatedForLimitNotification(
          sellerId,
          candidates.length,
          seller.listingLimit,
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send limit-deactivation notification: ${(err as Error).message}`,
          ),
        );

      this.adminTrackerService
        .track(sellerId, UserAction.LISTINGS_DEACTIVATED_FOR_LIMIT, {
          deactivatedCount: candidates.length,
          listingIds: ids.map((id) => id.toString()),
          listingLimit: seller.listingLimit,
        })
        .catch(() => undefined);

      deactivated += candidates.length;
    }

    if (deactivated > 0) {
      this.logger.log(
        `Deactivated ${deactivated} listing(s) to bring sellers within their limits`,
      );
    }
    return deactivated;
  }

  // ─── 7. Fail stale pending payments (>24h) ───

  @Cron(CronExpression.EVERY_HOUR, { timeZone: CRON_TIMEZONE })
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

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { timeZone: CRON_TIMEZONE })
  async handleStaleRejectedListings(): Promise<number> {
    const cutoff = new Date(Date.now() - daysToMs(this.activeDays));

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

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: CRON_TIMEZONE })
  async handleStaleReservedListings(): Promise<number> {
    const cutoff = new Date(Date.now() - daysToMs(STALE_RESERVED_DAYS));
    const newExpiresAt = new Date(Date.now() + daysToMs(this.activeDays));

    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.RESERVED,
        updatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const ids = staleListings.map((l) => l._id);
    // Only extends a listing whose expiry has passed or is sooner than the
    // standard window. Setting it unconditionally overwrote the longer expiry a
    // package had paid for, and handed a free extension to listings without one.
    const result = await this.listingModel.updateMany(
      { _id: { $in: ids }, expiresAt: { $lt: newExpiresAt } },
      {
        $set: {
          status: ListingStatus.ACTIVE,
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        },
      },
    );
    await this.listingModel.updateMany(
      { _id: { $in: ids }, expiresAt: { $gte: newExpiresAt } },
      { $set: { status: ListingStatus.ACTIVE, updatedAt: new Date() } },
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

  @Cron(CronExpression.EVERY_DAY_AT_5AM, { timeZone: CRON_TIMEZONE })
  async handleStalePendingReviewListings(): Promise<number> {
    const cutoff = new Date(Date.now() - daysToMs(STALE_PENDING_REVIEW_DAYS));

    const staleListings = await this.listingModel
      .find({
        status: ListingStatus.PENDING_REVIEW,
        updatedAt: { $lte: cutoff },
      })
      .select('_id sellerId title')
      .exec();

    if (staleListings.length === 0) return 0;

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + daysToMs(this.activeDays));

    const ids = staleListings.map((l) => l._id);
    // Same guard as the reserved revival: never shorten an expiry a package
    // extended.
    const result = await this.listingModel.updateMany(
      { _id: { $in: ids }, expiresAt: { $lt: newExpiresAt } },
      {
        $set: {
          status: ListingStatus.ACTIVE,
          expiresAt: newExpiresAt,
          updatedAt: now,
        },
      },
    );
    await this.listingModel.updateMany(
      { _id: { $in: ids }, expiresAt: { $gte: newExpiresAt } },
      { $set: { status: ListingStatus.ACTIVE, updatedAt: now } },
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

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { timeZone: CRON_TIMEZONE })
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

  // ─── 12. Guard activeListingCount consistency (floor at 0) ───

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { timeZone: CRON_TIMEZONE })
  async fixNegativeActiveListingCounts(): Promise<number> {
    const result = await this.userModel.updateMany(
      { activeListingCount: { $lt: 0 } },
      { $set: { activeListingCount: 0 } },
    );

    if (result.modifiedCount > 0) {
      this.logger.warn(
        `Fixed ${result.modifiedCount} users with negative activeListingCount`,
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
