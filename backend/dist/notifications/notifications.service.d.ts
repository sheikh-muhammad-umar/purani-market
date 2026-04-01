import { Model } from 'mongoose';
import { FcmProvider, PushNotificationPayload } from './providers/fcm.provider.js';
import { HmsProvider } from './providers/hms.provider.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { FavoriteDocument } from '../favorites/schemas/favorite.schema.js';
export type NotificationType = 'messages' | 'offers' | 'productUpdates' | 'promotions' | 'packageAlerts';
export declare class NotificationsService {
    private readonly fcmProvider;
    private readonly hmsProvider;
    private readonly userModel;
    private readonly favoriteModel;
    private readonly logger;
    constructor(fcmProvider: FcmProvider, hmsProvider: HmsProvider, userModel: Model<UserDocument>, favoriteModel: Model<FavoriteDocument>);
    sendToUser(userId: string, type: NotificationType, payload: PushNotificationPayload): Promise<boolean>;
    isNotificationEnabled(user: UserDocument, type: NotificationType): boolean;
    private dispatchToDevices;
    sendNewMessageNotification(recipientUserId: string, senderName: string, messagePreview: string, conversationId: string): Promise<boolean>;
    sendPriceDropNotification(userId: string, listingTitle: string, oldPrice: number, newPrice: number, listingId: string): Promise<boolean>;
    sendStatusChangeNotification(userId: string, listingTitle: string, newStatus: string, listingId: string): Promise<boolean>;
    sendNewOfferNotification(sellerUserId: string, buyerName: string, listingTitle: string, listingId: string): Promise<boolean>;
    sendPaymentSuccessNotification(userId: string, packageName: string, amount: number): Promise<boolean>;
    sendAdLimitReachedNotification(userId: string): Promise<boolean>;
    sendFeaturedAdNotification(userId: string, listingTitle: string, listingId: string): Promise<boolean>;
    sendFeaturedAdExpirationReminder(userId: string, listingTitle: string, listingId: string, daysRemaining: number): Promise<boolean>;
    updateNotificationPreferences(userId: string, preferences: Partial<Record<NotificationType, boolean>>): Promise<UserDocument>;
    notifyFavoritedListingPriceChange(listingId: string, listingTitle: string, oldPrice: number, newPrice: number): Promise<void>;
    notifyFavoritedListingStatusChange(listingId: string, listingTitle: string, newStatus: string): Promise<void>;
}
