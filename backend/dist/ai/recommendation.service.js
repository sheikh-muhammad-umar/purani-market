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
var RecommendationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const user_activity_schema_js_1 = require("./schemas/user-activity.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
let RecommendationService = RecommendationService_1 = class RecommendationService {
    activityModel;
    listingModel;
    logger = new common_1.Logger(RecommendationService_1.name);
    constructor(activityModel, listingModel) {
        this.activityModel = activityModel;
        this.listingModel = listingModel;
    }
    async trackActivity(userId, action, data) {
        const activity = new this.activityModel({
            userId: new mongoose_2.Types.ObjectId(userId),
            action,
            productListingId: data.productListingId
                ? new mongoose_2.Types.ObjectId(data.productListingId)
                : undefined,
            searchQuery: data.searchQuery,
            categoryId: data.categoryId
                ? new mongoose_2.Types.ObjectId(data.categoryId)
                : undefined,
            metadata: data.metadata ? new Map(Object.entries(data.metadata)) : new Map(),
        });
        return activity.save();
    }
    async getRecommendations(userId, lat, lng, limit = 20) {
        const safeLimit = Math.min(Math.max(1, limit), 20);
        const activityCount = await this.activityModel
            .countDocuments({ userId: new mongoose_2.Types.ObjectId(userId) })
            .exec();
        if (activityCount === 0) {
            return this.getColdStartRecommendations(lat, lng, safeLimit);
        }
        return this.getPersonalizedRecommendations(userId, safeLimit);
    }
    async getPersonalizedRecommendations(userId, limit) {
        const userObjId = new mongoose_2.Types.ObjectId(userId);
        const dismissedActivities = await this.activityModel
            .find({ userId: userObjId, action: user_activity_schema_js_1.UserAction.DISMISS })
            .select('productListingId')
            .exec();
        const dismissedIds = dismissedActivities
            .filter((a) => a.productListingId)
            .map((a) => a.productListingId);
        const recentActivities = await this.activityModel
            .find({
            userId: userObjId,
            action: { $in: [user_activity_schema_js_1.UserAction.VIEW, user_activity_schema_js_1.UserAction.FAVORITE, user_activity_schema_js_1.UserAction.CONTACT] },
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .exec();
        const categoryIds = [
            ...new Set(recentActivities
                .filter((a) => a.categoryId)
                .map((a) => a.categoryId.toString())),
        ].map((id) => new mongoose_2.Types.ObjectId(id));
        const viewedIds = recentActivities
            .filter((a) => a.productListingId)
            .map((a) => a.productListingId);
        const excludeIds = [...dismissedIds, ...viewedIds];
        const filter = {
            status: product_listing_schema_js_1.ListingStatus.ACTIVE,
            deletedAt: { $exists: false },
        };
        if (excludeIds.length > 0) {
            filter._id = { $nin: excludeIds };
        }
        if (categoryIds.length > 0) {
            filter.categoryId = { $in: categoryIds };
        }
        return this.listingModel
            .find(filter)
            .sort({ isFeatured: -1, viewCount: -1, createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async getColdStartRecommendations(lat, lng, limit = 20) {
        const filter = {
            status: product_listing_schema_js_1.ListingStatus.ACTIVE,
            deletedAt: { $exists: false },
        };
        if (lat !== undefined && lng !== undefined) {
            filter.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: 25000,
                },
            };
        }
        return this.listingModel
            .find(filter)
            .sort({ isFeatured: -1, viewCount: -1, createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async dismissRecommendation(userId, productListingId) {
        await this.trackActivity(userId, user_activity_schema_js_1.UserAction.DISMISS, { productListingId });
    }
    async updateRecommendationModels() {
        this.logger.log('Starting daily recommendation model update...');
        try {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const result = await this.activityModel
                .deleteMany({ createdAt: { $lt: ninetyDaysAgo } })
                .exec();
            this.logger.log(`Recommendation model update complete. Cleaned ${result.deletedCount} old activities.`);
        }
        catch (error) {
            this.logger.error('Failed to update recommendation models', error);
        }
    }
};
exports.RecommendationService = RecommendationService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RecommendationService.prototype, "updateRecommendationModels", null);
exports.RecommendationService = RecommendationService = RecommendationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_activity_schema_js_1.UserActivity.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], RecommendationService);
//# sourceMappingURL=recommendation.service.js.map