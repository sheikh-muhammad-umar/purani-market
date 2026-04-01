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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
const conversation_schema_js_1 = require("../messaging/schemas/conversation.schema.js");
const review_schema_js_1 = require("../reviews/schemas/review.schema.js");
const package_purchase_schema_js_1 = require("../packages/schemas/package-purchase.schema.js");
const auth_service_js_1 = require("../auth/auth.service.js");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const ad_package_schema_js_1 = require("../packages/schemas/ad-package.schema.js");
let AdminService = class AdminService {
    userModel;
    listingModel;
    conversationModel;
    reviewModel;
    packagePurchaseModel;
    authService;
    notificationsService;
    constructor(userModel, listingModel, conversationModel, reviewModel, packagePurchaseModel, authService, notificationsService) {
        this.userModel = userModel;
        this.listingModel = listingModel;
        this.conversationModel = conversationModel;
        this.reviewModel = reviewModel;
        this.packagePurchaseModel = packagePurchaseModel;
        this.authService = authService;
        this.notificationsService = notificationsService;
    }
    async listUsers(query) {
        const { page = 1, limit = 20, search, role, status, registeredFrom, registeredTo } = query;
        const filter = {};
        if (search) {
            const regex = new RegExp(search, 'i');
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
            data: users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async getUserActivitySummary(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const [listingsCount, conversationsCount, violationsCount] = await Promise.all([
            this.listingModel.countDocuments({ sellerId: userObjectId }).exec(),
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
        return { listingsCount, conversationsCount, violationsCount };
    }
    async updateUserStatus(userId, status) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.status = status;
        await user.save();
        if (status === user_schema_js_1.UserStatus.SUSPENDED) {
            await this.authService.invalidateAllSessions(userId);
        }
        return user;
    }
    async updateUserRole(userId, role) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.role = role;
        await user.save();
        await this.authService.invalidateAllSessions(userId);
        return user;
    }
    async updateAdLimit(userId, adLimit) {
        const user = await this.userModel
            .findByIdAndUpdate(userId, { $set: { adLimit } }, { new: true })
            .exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async getPendingListings(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const filter = { status: product_listing_schema_js_1.ListingStatus.PENDING_REVIEW };
        const [listings, total] = await Promise.all([
            this.listingModel
                .find(filter)
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.listingModel.countDocuments(filter).exec(),
        ]);
        return {
            data: listings,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async approveListing(listingId) {
        const listing = await this.listingModel.findById(listingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        listing.status = product_listing_schema_js_1.ListingStatus.ACTIVE;
        await listing.save();
        return listing;
    }
    async rejectListing(listingId, reason) {
        const listing = await this.listingModel.findById(listingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        listing.status = product_listing_schema_js_1.ListingStatus.REJECTED;
        listing.rejectionReason = reason;
        await listing.save();
        await this.notificationsService.sendToUser(listing.sellerId.toString(), 'productUpdates', {
            title: 'Listing rejected',
            body: `Your listing "${listing.title}" was rejected. Reason: ${reason}`,
            data: {
                type: 'listing_rejected',
                listingId: listing._id.toString(),
                reason,
            },
        });
        return listing;
    }
    async getAnalytics(dateFrom, dateTo) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth() - 6, 1);
        const to = dateTo ? new Date(dateTo) : now;
        const [keyMetrics, timeSeries, categoryAnalytics] = await Promise.all([
            this.getKeyMetrics(thirtyDaysAgo),
            this.getTimeSeries(from, to),
            this.getCategoryAnalytics(),
        ]);
        return { keyMetrics, timeSeries, categoryAnalytics };
    }
    async exportAnalytics(dateFrom, dateTo) {
        const analytics = await this.getAnalytics(dateFrom, dateTo);
        return {
            generatedAt: new Date().toISOString(),
            dateRange: { from: dateFrom, to: dateTo },
            keyMetrics: analytics.keyMetrics,
            timeSeries: analytics.timeSeries,
            categoryAnalytics: analytics.categoryAnalytics,
        };
    }
    async listPackagePurchases(query) {
        const { page = 1, limit = 20, dateFrom, dateTo, sellerId, type, status } = query;
        const filter = {};
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom)
                filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo)
                filter.createdAt.$lte = new Date(dateTo);
        }
        if (sellerId && mongoose_2.Types.ObjectId.isValid(sellerId)) {
            filter.sellerId = new mongoose_2.Types.ObjectId(sellerId);
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
    async listPayments(query) {
        const { page = 1, limit = 20, dateFrom, dateTo, sellerId } = query;
        const filter = {
            paymentStatus: { $in: [package_purchase_schema_js_1.PaymentStatus.COMPLETED, package_purchase_schema_js_1.PaymentStatus.FAILED, package_purchase_schema_js_1.PaymentStatus.REFUNDED] },
        };
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom)
                filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo)
                filter.createdAt.$lte = new Date(dateTo);
        }
        if (sellerId && mongoose_2.Types.ObjectId.isValid(sellerId)) {
            filter.sellerId = new mongoose_2.Types.ObjectId(sellerId);
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
    async getSellerAdInfo(sellerId) {
        const user = await this.userModel.findById(sellerId).exec();
        if (!user) {
            throw new common_1.NotFoundException('Seller not found');
        }
        const now = new Date();
        const activePackages = await this.packagePurchaseModel.aggregate([
            {
                $match: {
                    sellerId: new mongoose_2.Types.ObjectId(sellerId),
                    type: ad_package_schema_js_1.AdPackageType.AD_SLOTS,
                    paymentStatus: package_purchase_schema_js_1.PaymentStatus.COMPLETED,
                    expiresAt: { $gt: now },
                    remainingQuantity: { $gt: 0 },
                },
            },
            {
                $group: {
                    _id: null,
                    totalSlots: { $sum: '$remainingQuantity' },
                },
            },
        ]).exec();
        const activePackageSlots = activePackages[0]?.totalSlots || 0;
        const remainingFreeSlots = Math.max(0, user.adLimit - user.activeAdCount);
        return {
            sellerId,
            activeAdCount: user.activeAdCount,
            adLimit: user.adLimit,
            remainingFreeSlots,
            activePackageSlots,
        };
    }
    async getKeyMetrics(thirtyDaysAgo) {
        const [totalUsers, activeUsers, totalListings, totalConversations, purchaseAgg] = await Promise.all([
            this.userModel.countDocuments().exec(),
            this.userModel.countDocuments({ lastLoginAt: { $gte: thirtyDaysAgo } }).exec(),
            this.listingModel.countDocuments().exec(),
            this.conversationModel.countDocuments().exec(),
            this.packagePurchaseModel.aggregate([
                { $match: { paymentStatus: package_purchase_schema_js_1.PaymentStatus.COMPLETED } },
                {
                    $group: {
                        _id: null,
                        totalPurchases: { $sum: 1 },
                        totalRevenue: { $sum: '$price' },
                    },
                },
            ]).exec(),
        ]);
        const purchaseData = purchaseAgg[0] || { totalPurchases: 0, totalRevenue: 0 };
        return {
            totalUsers,
            activeUsers,
            totalListings,
            totalConversations,
            totalPackagePurchases: purchaseData.totalPurchases,
            totalRevenue: purchaseData.totalRevenue,
        };
    }
    async getTimeSeries(from, to) {
        const dateMatch = { $gte: from, $lte: to };
        const groupByDate = {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        };
        const [registrations, listings, conversations, purchases] = await Promise.all([
            this.userModel.aggregate([
                { $match: { createdAt: dateMatch } },
                { $group: { _id: groupByDate, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', count: 1 } },
            ]).exec(),
            this.listingModel.aggregate([
                { $match: { createdAt: dateMatch } },
                { $group: { _id: groupByDate, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', count: 1 } },
            ]).exec(),
            this.conversationModel.aggregate([
                { $match: { createdAt: dateMatch } },
                { $group: { _id: groupByDate, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', count: 1 } },
            ]).exec(),
            this.packagePurchaseModel.aggregate([
                { $match: { createdAt: dateMatch, paymentStatus: package_purchase_schema_js_1.PaymentStatus.COMPLETED } },
                { $group: { _id: groupByDate, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', count: 1 } },
            ]).exec(),
        ]);
        return { registrations, listings, conversations, purchases };
    }
    async getCategoryAnalytics() {
        return this.listingModel.aggregate([
            { $group: { _id: '$categoryId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, categoryId: { $toString: '$_id' }, count: 1 } },
        ]).exec();
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __param(2, (0, mongoose_1.InjectModel)(conversation_schema_js_1.Conversation.name)),
    __param(3, (0, mongoose_1.InjectModel)(review_schema_js_1.Review.name)),
    __param(4, (0, mongoose_1.InjectModel)(package_purchase_schema_js_1.PackagePurchase.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        auth_service_js_1.AuthService,
        notifications_service_js_1.NotificationsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map