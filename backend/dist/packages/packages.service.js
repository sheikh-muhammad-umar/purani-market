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
exports.PackagesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const schedule_1 = require("@nestjs/schedule");
const ad_package_schema_js_1 = require("./schemas/ad-package.schema.js");
const package_purchase_schema_js_1 = require("./schemas/package-purchase.schema.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
const payments_service_js_1 = require("../payments/payments.service.js");
let PackagesService = class PackagesService {
    adPackageModel;
    packagePurchaseModel;
    userModel;
    listingModel;
    paymentsService;
    constructor(adPackageModel, packagePurchaseModel, userModel, listingModel, paymentsService) {
        this.adPackageModel = adPackageModel;
        this.packagePurchaseModel = packagePurchaseModel;
        this.userModel = userModel;
        this.listingModel = listingModel;
        this.paymentsService = paymentsService;
    }
    async createPackage(dto) {
        const categoryPricing = (dto.categoryPricing || []).map((cp) => ({
            categoryId: new mongoose_2.Types.ObjectId(cp.categoryId),
            price: cp.price,
        }));
        const pkg = new this.adPackageModel({
            name: dto.name,
            type: dto.type,
            duration: dto.duration,
            quantity: dto.quantity,
            defaultPrice: dto.defaultPrice,
            categoryPricing,
            isActive: dto.isActive ?? true,
        });
        return pkg.save();
    }
    async updatePackage(id, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Package not found');
        }
        const pkg = await this.adPackageModel.findById(id).exec();
        if (!pkg) {
            throw new common_1.NotFoundException('Package not found');
        }
        if (dto.name !== undefined)
            pkg.name = dto.name;
        if (dto.type !== undefined)
            pkg.type = dto.type;
        if (dto.duration !== undefined)
            pkg.duration = dto.duration;
        if (dto.quantity !== undefined)
            pkg.quantity = dto.quantity;
        if (dto.defaultPrice !== undefined)
            pkg.defaultPrice = dto.defaultPrice;
        if (dto.isActive !== undefined)
            pkg.isActive = dto.isActive;
        if (dto.categoryPricing !== undefined) {
            pkg.categoryPricing = dto.categoryPricing.map((cp) => ({
                categoryId: new mongoose_2.Types.ObjectId(cp.categoryId),
                price: cp.price,
            }));
        }
        return pkg.save();
    }
    async findAll() {
        return this.adPackageModel
            .find({ isActive: true })
            .sort({ type: 1, duration: 1 })
            .exec();
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Package not found');
        }
        const pkg = await this.adPackageModel.findById(id).exec();
        if (!pkg) {
            throw new common_1.NotFoundException('Package not found');
        }
        return pkg;
    }
    async getMyPurchases(sellerId) {
        return this.packagePurchaseModel
            .find({ sellerId: new mongoose_2.Types.ObjectId(sellerId) })
            .sort({ createdAt: -1 })
            .populate('packageId')
            .exec();
    }
    async purchasePackages(sellerId, dto) {
        if (!dto.items || dto.items.length === 0) {
            throw new common_1.BadRequestException('At least one package item is required');
        }
        const purchases = [];
        let totalAmount = 0;
        for (const item of dto.items) {
            const pkg = await this.findById(item.packageId);
            if (!pkg.isActive) {
                throw new common_1.BadRequestException(`Package "${pkg.name}" is not available`);
            }
            let price = pkg.defaultPrice;
            if (item.categoryId && mongoose_2.Types.ObjectId.isValid(item.categoryId)) {
                const catPricing = pkg.categoryPricing.find((cp) => cp.categoryId.toString() === item.categoryId);
                if (catPricing) {
                    price = catPricing.price;
                }
            }
            totalAmount += price;
            const purchase = new this.packagePurchaseModel({
                sellerId: new mongoose_2.Types.ObjectId(sellerId),
                packageId: pkg._id,
                categoryId: item.categoryId ? new mongoose_2.Types.ObjectId(item.categoryId) : undefined,
                type: pkg.type, quantity: pkg.quantity, remainingQuantity: pkg.quantity,
                duration: pkg.duration, price,
                paymentMethod: dto.paymentMethod, paymentStatus: package_purchase_schema_js_1.PaymentStatus.PENDING,
            });
            const saved = await purchase.save();
            purchases.push(saved);
        }
        const purchaseIds = purchases.map((p) => p._id.toString());
        const paymentResult = await this.paymentsService.initiatePayment(dto.paymentMethod, {
            amount: totalAmount, currency: 'PKR', purchaseIds, sellerId,
            callbackUrl: '/api/packages/payment-callback',
        });
        await this.packagePurchaseModel.updateMany({ _id: { $in: purchases.map((p) => p._id) } }, { $set: { paymentTransactionId: paymentResult.transactionId } });
        return { purchases, redirectUrl: paymentResult.redirectUrl, transactionId: paymentResult.transactionId };
    }
    async handlePaymentCallback(payload) {
        const { transactionId, paymentMethod } = payload;
        if (!transactionId) {
            throw new common_1.BadRequestException('Transaction ID is required');
        }
        const purchases = await this.packagePurchaseModel
            .find({ paymentTransactionId: transactionId })
            .exec();
        if (purchases.length === 0) {
            throw new common_1.NotFoundException('No purchases found for this transaction');
        }
        const verification = await this.paymentsService.verifyCallback(paymentMethod, payload);
        if (verification.status === 'completed') {
            const now = new Date();
            for (const purchase of purchases) {
                const expiresAt = new Date(now.getTime() + purchase.duration * 24 * 60 * 60 * 1000);
                await this.packagePurchaseModel.updateOne({ _id: purchase._id }, {
                    $set: {
                        paymentStatus: package_purchase_schema_js_1.PaymentStatus.COMPLETED,
                        activatedAt: now,
                        expiresAt,
                    },
                });
                if (purchase.type === ad_package_schema_js_1.AdPackageType.AD_SLOTS) {
                    await this.userModel.updateOne({ _id: purchase.sellerId }, { $inc: { adLimit: purchase.quantity } });
                }
            }
            return { status: 'success', message: 'Packages activated successfully' };
        }
        await this.packagePurchaseModel.updateMany({ paymentTransactionId: transactionId }, { $set: { paymentStatus: package_purchase_schema_js_1.PaymentStatus.FAILED } });
        return { status: 'failed', message: verification.reason || 'Payment failed' };
    }
    async featureListing(listingId, sellerId) {
        if (!mongoose_2.Types.ObjectId.isValid(listingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(listingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.sellerId.toString() !== sellerId) {
            throw new common_1.ForbiddenException('You can only feature your own listings');
        }
        if (listing.isFeatured) {
            throw new common_1.BadRequestException('Listing is already featured');
        }
        const now = new Date();
        const activePurchase = await this.packagePurchaseModel.findOne({
            sellerId: new mongoose_2.Types.ObjectId(sellerId),
            type: ad_package_schema_js_1.AdPackageType.FEATURED_ADS,
            paymentStatus: package_purchase_schema_js_1.PaymentStatus.COMPLETED,
            remainingQuantity: { $gt: 0 },
            expiresAt: { $gt: now },
        }).exec();
        if (!activePurchase) {
            throw new common_1.BadRequestException('No active featured ad package available. Please purchase a featured ads package.');
        }
        await this.packagePurchaseModel.updateOne({ _id: activePurchase._id }, { $inc: { remainingQuantity: -1 } });
        const updated = await this.listingModel.findByIdAndUpdate(listingId, {
            $set: {
                isFeatured: true,
                featuredUntil: activePurchase.expiresAt,
            },
        }, { new: true }).exec();
        return updated;
    }
    async checkAdLimit(sellerId) {
        const user = await this.userModel.findById(sellerId).exec();
        if (!user) {
            throw new common_1.NotFoundException('Seller not found');
        }
        const canPost = user.activeAdCount < user.adLimit;
        return {
            canPost,
            activeAdCount: user.activeAdCount,
            adLimit: user.adLimit,
            message: canPost
                ? undefined
                : 'You have reached your ad limit. Please purchase an ad package to post more ads.',
        };
    }
    async handleExpiredFeaturedAds() {
        const result = await this.listingModel.updateMany({ isFeatured: true, featuredUntil: { $lte: new Date() } }, { $set: { isFeatured: false }, $unset: { featuredUntil: '' } });
        return result.modifiedCount;
    }
};
exports.PackagesService = PackagesService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagesService.prototype, "handleExpiredFeaturedAds", null);
exports.PackagesService = PackagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(ad_package_schema_js_1.AdPackage.name)),
    __param(1, (0, mongoose_1.InjectModel)(package_purchase_schema_js_1.PackagePurchase.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __param(3, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        payments_service_js_1.PaymentsService])
], PackagesService);
//# sourceMappingURL=packages.service.js.map