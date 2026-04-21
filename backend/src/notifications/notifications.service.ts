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

export type NotificationType =
  | 'messages'
  | 'offers'
  | 'productUpdates'
  | 'promotions'
  | 'packageAlerts';

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
    return this.sendToUser(recipientUserId, 'messages', {
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
    return this.sendToUser(userId, 'productUpdates', {
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
    return this.sendToUser(userId, 'productUpdates', {
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
    return this.sendToUser(sellerUserId, 'offers', {
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
    return this.sendToUser(userId, 'packageAlerts', {
      title: 'Payment successful',
      body: `Your purchase of "${packageName}" (Rs ${amount}) was successful`,
      data: { type: 'payment_success' },
    });
  }

  async sendAdLimitReachedNotification(userId: string): Promise<boolean> {
    return this.sendToUser(userId, 'packageAlerts', {
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
    return this.sendToUser(userId, 'packageAlerts', {
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
    return this.sendToUser(userId, 'packageAlerts', {
      title: 'Featured ad expiring soon',
      body: `"${listingTitle}" featured status expires in ${daysRemaining} day(s)`,
      data: { type: 'featured_ad_expiring', listingId },
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
      throw new Error('User not found');
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
