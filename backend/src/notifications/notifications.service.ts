import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  FcmProvider,
  PushNotificationPayload,
} from './providers/fcm.provider.js';
import { HmsProvider } from './providers/hms.provider.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  Favorite,
  FavoriteDocument,
} from '../favorites/schemas/favorite.schema.js';
import { ERROR } from '../common/constants/error-messages.js';
import {
  LISTING_ACTIVE_DAYS,
  LISTING_DEACTIVATED_CLEANUP_DAYS,
} from '../common/constants/index.js';

export enum NotificationType {
  MESSAGES = 'messages',
  OFFERS = 'offers',
  PRODUCT_UPDATES = 'productUpdates',
  PROMOTIONS = 'promotions',
  PACKAGE_ALERTS = 'packageAlerts',
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly fcmProvider: FcmProvider,
    private readonly hmsProvider: HmsProvider,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
  ) {}

  /**
   * Send push notification to a user, respecting their preferences.
   * Routes to FCM or HMS based on device platform.
   */
  async sendToUser(
    userId: string,
    type: NotificationType,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      this.logger.warn(`User ${userId} not found, skipping notification`);
      return false;
    }

    // Check user preferences
    if (!this.isNotificationEnabled(user, type)) {
      this.logger.debug(
        `User ${userId} has disabled ${type} notifications, skipping`,
      );
      return false;
    }

    if (!user.deviceTokens || user.deviceTokens.length === 0) {
      this.logger.debug(`User ${userId} has no device tokens, skipping`);
      return false;
    }

    return this.dispatchToDevices(user.deviceTokens, payload);
  }

  /**
   * Check if a notification type is enabled for a user.
   */
  isNotificationEnabled(user: UserDocument, type: NotificationType): boolean {
    const prefs = user.notificationPreferences;
    if (!prefs) return true; // Default to enabled if no preferences set
    return prefs[type] !== false;
  }

  /**
   * Dispatch notification to device tokens, routing by platform.
   */
  private async dispatchToDevices(
    deviceTokens: Array<{ platform: string; token: string }>,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    const fcmTokens: string[] = [];
    const hmsTokens: string[] = [];

    for (const dt of deviceTokens) {
      if (dt.platform === 'huawei') {
        hmsTokens.push(dt.token);
      } else {
        // android, ios, web all go through FCM
        fcmTokens.push(dt.token);
      }
    }

    const results: boolean[] = [];

    if (fcmTokens.length > 0) {
      results.push(
        await this.fcmProvider.sendToMultipleDevices(fcmTokens, payload),
      );
    }
    if (hmsTokens.length > 0) {
      results.push(
        await this.hmsProvider.sendToMultipleDevices(hmsTokens, payload),
      );
    }

    return results.every((r) => r);
  }

  // --- Notification trigger methods ---

  async sendNewMessageNotification(
    recipientUserId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string,
  ): Promise<boolean> {
    return this.sendToUser(recipientUserId, NotificationType.MESSAGES, {
      title: `New message from ${senderName}`,
      body: messagePreview,
      data: { type: 'new_message', conversationId },
    });
  }

  async sendPriceDropNotification(
    userId: string,
    listingTitle: string,
    oldPrice: number,
    newPrice: number,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Price drop on a favorited item!',
      body: `${listingTitle} dropped from Rs ${oldPrice} to Rs ${newPrice}`,
      data: { type: 'price_drop', listingId },
    });
  }

  async sendStatusChangeNotification(
    userId: string,
    listingTitle: string,
    newStatus: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Listing status updated',
      body: `${listingTitle} is now ${newStatus}`,
      data: { type: 'status_change', listingId, status: newStatus },
    });
  }

  async sendNewOfferNotification(
    sellerUserId: string,
    buyerName: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(sellerUserId, NotificationType.OFFERS, {
      title: 'New offer received',
      body: `${buyerName} is interested in "${listingTitle}"`,
      data: { type: 'new_offer', listingId },
    });
  }

  async sendPaymentSuccessNotification(
    userId: string,
    packageName: string,
    amount: number,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Payment successful',
      body: `Your purchase of "${packageName}" (Rs ${amount}) was successful`,
      data: { type: 'payment_success' },
    });
  }

  async sendAdLimitReachedNotification(userId: string): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Free ad limit reached',
      body: 'You have reached your free ad limit. Purchase a package to post more ads.',
      data: { type: 'ad_limit_reached' },
    });
  }

  async sendFeaturedAdNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Your ad is now featured!',
      body: `"${listingTitle}" is now a featured ad and will appear at the top of search results`,
      data: { type: 'featured_ad_activated', listingId },
    });
  }

  async sendFeaturedAdExpirationReminder(
    userId: string,
    listingTitle: string,
    listingId: string,
    daysRemaining: number,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Featured ad expiring soon',
      body: `"${listingTitle}" featured status expires in ${daysRemaining} day(s)`,
      data: { type: 'featured_ad_expiring', listingId },
    });
  }

  async sendListingExpirationReminder(
    userId: string,
    listingTitle: string,
    listingId: string,
    daysRemaining: number,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Listing expiring soon',
      body: `"${listingTitle}" will expire in ${daysRemaining} day(s). Renew it to keep it active.`,
      data: { type: 'listing_expiring', listingId },
    });
  }

  async sendListingExpiredNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Listing expired',
      body: `"${listingTitle}" has expired after ${LISTING_ACTIVE_DAYS} days. Reactivate it from your listings.`,
      data: { type: 'listing_expired', listingId },
    });
  }

  async sendPackageExpirationReminder(
    userId: string,
    packageName: string,
    remainingQuantity: number,
    daysRemaining: number,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Package expiring soon',
      body: `Your "${packageName}" package expires in ${daysRemaining} day(s) with ${remainingQuantity} unused slot(s).`,
      data: { type: 'package_expiring' },
    });
  }

  async sendAdSlotsExpiredNotification(
    userId: string,
    packageName: string,
    slotsLost: number,
    newAdLimit: number,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Ad slots package expired',
      body: `Your "${packageName}" package has expired. Your ad limit has been reduced by ${slotsLost} to ${newAdLimit}.`,
      data: { type: 'ad_slots_expired' },
    });
  }

  async sendDeactivatedListingCleanupNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Inactive listing removed',
      body: `"${listingTitle}" was removed after being inactive for ${LISTING_DEACTIVATED_CLEANUP_DAYS} days.`,
      data: { type: 'deactivated_cleanup', listingId },
    });
  }

  async sendStalePaymentFailedNotification(
    userId: string,
    purchaseId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PACKAGE_ALERTS, {
      title: 'Payment expired',
      body: 'Your pending package payment was not completed within 24 hours and has been cancelled.',
      data: { type: 'stale_payment_failed', purchaseId },
    });
  }

  async sendReservedListingRevertedNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Reserved listing reactivated',
      body: `"${listingTitle}" was automatically reactivated after being reserved for 14 days.`,
      data: { type: 'reserved_reverted', listingId },
    });
  }

  async sendRejectedListingCleanupNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Rejected listing removed',
      body: `"${listingTitle}" was removed after reaching the maximum rejection limit without resubmission.`,
      data: { type: 'rejected_cleanup', listingId },
    });
  }

  async sendListingAutoApprovedNotification(
    userId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Listing approved',
      body: `"${listingTitle}" has been automatically approved and is now live.`,
      data: { type: 'listing_auto_approved', listingId },
    });
  }

  async sendAccountSuspendedNotification(userId: string): Promise<boolean> {
    return this.sendToUser(userId, NotificationType.PRODUCT_UPDATES, {
      title: 'Account suspended',
      body: 'Your account has been suspended. All your active listings have been deactivated.',
      data: { type: 'account_suspended' },
    });
  }

  // --- Task 13.2: Update notification preferences ---

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<Record<NotificationType, boolean>>,
  ): Promise<UserDocument> {
    const updateFields: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (value !== undefined) {
        updateFields[`notificationPreferences.${key}`] = value;
      }
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateFields }, { new: true })
      .exec();

    if (!user) {
      throw new Error(ERROR.USER_NOT_FOUND);
    }
    return user;
  }

  // --- Task 13.3: Notify users who favorited a listing on price/status change ---

  async notifyFavoritedListingPriceChange(
    listingId: string,
    listingTitle: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<void> {
    if (newPrice >= oldPrice) return; // Only notify on price drops

    const favorites = await this.favoriteModel
      .find({ productListingId: new Types.ObjectId(listingId) })
      .exec();

    for (const fav of favorites) {
      await this.sendPriceDropNotification(
        fav.userId.toString(),
        listingTitle,
        oldPrice,
        newPrice,
        listingId,
      );
    }
  }

  async notifyFavoritedListingStatusChange(
    listingId: string,
    listingTitle: string,
    newStatus: string,
  ): Promise<void> {
    const favorites = await this.favoriteModel
      .find({ productListingId: new Types.ObjectId(listingId) })
      .exec();

    for (const fav of favorites) {
      await this.sendStatusChangeNotification(
        fav.userId.toString(),
        listingTitle,
        newStatus,
        listingId,
      );
    }
  }
}
