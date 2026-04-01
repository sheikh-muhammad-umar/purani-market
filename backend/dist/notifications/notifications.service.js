"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const fcm_provider_js_1 = require("./providers/fcm.provider.js");
const hms_provider_js_1 = require("./providers/hms.provider.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const favorite_schema_js_1 = require("../favorites/schemas/favorite.schema.js");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    fcmProvider;
    hmsProvider;
    userModel;
    favoriteModel;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(fcmProvider, hmsProvider, userModel, favoriteModel) {
        this.fcmProvider = fcmProvider;
        this.hmsProvider = hmsProvider;
        this.userModel = userModel;
        this.favoriteModel = favoriteModel;
    }
    async sendToUser(userId, type, payload) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            this.logger.warn(`User ${userId} not found, skipping notification`);
            return false;
        }
        if (!this.isNotificationEnabled(user, type)) {
            this.logger.debug(`User ${userId} has disabled ${type} notifications, skipping`);
            return false;
        }
        if (!user.deviceTokens || user.deviceTokens.length === 0) {
            this.logger.debug(`User ${userId} has no device tokens, skipping`);
            return false;
        }
        return this.dispatchToDevices(user.deviceTokens, payload);
    }
    isNotificationEnabled(user, type) {
        const prefs = user.notificationPreferences;
        if (!prefs)
            return true;
        return prefs[type] !== false;
    }
    async dispatchToDevices(deviceTokens, payload) {
        const fcmTokens = [];
        const hmsTokens = [];
        for (const dt of deviceTokens) {
            if (dt.platform === 'huawei') {
                hmsTokens.push(dt.token);
            }
            else {
                fcmTokens.push(dt.token);
            }
        }
        const results = [];
        if (fcmTokens.length > 0) {
            results.push(await this.fcmProvider.sendToMultipleDevices(fcmTokens, payload));
        }
        if (hmsTokens.length > 0) {
            results.push(await this.hmsProvider.sendToMultipleDevices(hmsTokens, payload));
        }
        return results.every((r) => r);
    }
    async sendNewMessageNotification(recipientUserId, senderName, messagePreview, conversationId) {
        return this.sendToUser(recipientUserId, 'messages', {
            title: `New message from ${senderName}`,
            body: messagePreview,
            data: { type: 'new_message', conversationId },
        });
    }
    async sendPriceDropNotification(userId, listingTitle, oldPrice, newPrice, listingId) {
        return this.sendToUser(userId, 'productUpdates', {
            title: 'Price drop on a favorited item!',
            body: `${listingTitle} dropped from Rs ${oldPrice} to Rs ${newPrice}`,
            data: { type: 'price_drop', listingId },
        });
    }
    async sendStatusChangeNotification(userId, listingTitle, newStatus, listingId) {
        return this.sendToUser(userId, 'productUpdates', {
            title: 'Listing status updated',
            body: `${listingTitle} is now ${newStatus}`,
            data: { type: 'status_change', listingId, status: newStatus },
        });
    }
    async sendNewOfferNotification(sellerUserId, buyerName, listingTitle, listingId) {
        return this.sendToUser(sellerUserId, 'offers', {
            title: 'New offer received',
            body: `${buyerName} is interested in "${listingTitle}"`,
            data: { type: 'new_offer', listingId },
        });
    }
    async sendPaymentSuccessNotification(userId, packageName, amount) {
        return this.sendToUser(userId, 'packageAlerts', {
            title: 'Payment successful',
            body: `Your purchase of "${packageName}" (Rs ${amount}) was successful`,
            data: { type: 'payment_success' },
        });
    }
    async sendAdLimitReachedNotification(userId) {
        return this.sendToUser(userId, 'packageAlerts', {
            title: 'Free ad limit reached',
            body: 'You have reached your free ad limit. Purchase a package to post more ads.',
            data: { type: 'ad_limit_reached' },
        });
    }
    async sendFeaturedAdNotification(userId, listingTitle, listingId) {
        return this.sendToUser(userId, 'packageAlerts', {
            title: 'Your ad is now featured!',
            body: `"${listingTitle}" is now a featured ad and will appear at the top of search results`,
            data: { type: 'featured_ad_activated', listingId },
        });
    }
    async sendFeaturedAdExpirationReminder(userId, listingTitle, listingId, daysRemaining) {
        return this.sendToUser(userId, 'packageAlerts', {
            title: 'Featured ad expiring soon',
            body: `"${listingTitle}" featured status expires in ${daysRemaining} day(s)`,
            data: { type: 'featured_ad_expiring', listingId },
        });
    }
    async updateNotificationPreferences(userId, preferences) {
        const updateFields = {};
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
    async notifyFavoritedListingPriceChange(listingId, listingTitle, oldPrice, newPrice) {
        if (newPrice >= oldPrice)
            return;
        const favorites = await this.favoriteModel
            .find({ productListingId: new mongoose_2.Types.ObjectId(listingId) })
            .exec();
        for (const fav of favorites) {
            await this.sendPriceDropNotification(fav.userId.toString(), listingTitle, oldPrice, newPrice, listingId);
        }
    }
    async notifyFavoritedListingStatusChange(listingId, listingTitle, newStatus) {
        const favorites = await this.favoriteModel
            .find({ productListingId: new mongoose_2.Types.ObjectId(listingId) })
            .exec();
        for (const fav of favorites) {
            await this.sendStatusChangeNotification(fav.userId.toString(), listingTitle, newStatus, listingId);
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __param(3, (0, mongoose_1.InjectModel)(favorite_schema_js_1.Favorite.name)),
    __metadata("design:paramtypes", [fcm_provider_js_1.FcmProvider,
        hms_provider_js_1.HmsProvider,
        mongoose_2.Model,
        mongoose_2.Model])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map