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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const review_schema_js_1 = require("./schemas/review.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
const PROHIBITED_WORDS = [
    'spam',
    'scam',
    'fake',
    'fraud',
    'illegal',
    'hate',
    'violence',
    'abuse',
];
let ReviewsService = class ReviewsService {
    reviewModel;
    listingModel;
    conversationModel;
    constructor(reviewModel, listingModel, conversationModel) {
        this.reviewModel = reviewModel;
        this.listingModel = listingModel;
        this.conversationModel = conversationModel;
    }
    async createReview(reviewerId, dto) {
        const { productListingId, rating, text } = dto;
        if (!mongoose_2.Types.ObjectId.isValid(productListingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(productListingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.sellerId.toString() === reviewerId) {
            throw new common_1.ForbiddenException('You cannot review your own listing');
        }
        const conversation = await this.conversationModel
            .findOne({
            buyerId: new mongoose_2.Types.ObjectId(reviewerId),
            sellerId: listing.sellerId,
            productListingId: new mongoose_2.Types.ObjectId(productListingId),
        })
            .exec();
        if (!conversation) {
            throw new common_1.BadRequestException('You must have a conversation with the seller about this listing before submitting a review');
        }
        const status = this.containsProhibitedContent(text || '')
            ? review_schema_js_1.ReviewStatus.PENDING
            : review_schema_js_1.ReviewStatus.APPROVED;
        try {
            const review = new this.reviewModel({
                reviewerId: new mongoose_2.Types.ObjectId(reviewerId),
                sellerId: listing.sellerId,
                productListingId: new mongoose_2.Types.ObjectId(productListingId),
                rating,
                text: text || '',
                status,
            });
            return await review.save();
        }
        catch (error) {
            if (error.code === 11000) {
                throw new common_1.ConflictException('You have already reviewed this listing');
            }
            throw error;
        }
    }
    async getReviewsByListing(listingId) {
        if (!mongoose_2.Types.ObjectId.isValid(listingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        return this.reviewModel
            .find({
            productListingId: new mongoose_2.Types.ObjectId(listingId),
            status: review_schema_js_1.ReviewStatus.APPROVED,
        })
            .populate('reviewerId', 'profile.firstName profile.lastName profile.avatar')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getReviewsBySeller(sellerId) {
        if (!mongoose_2.Types.ObjectId.isValid(sellerId)) {
            throw new common_1.NotFoundException('Seller not found');
        }
        const reviews = await this.reviewModel
            .find({
            sellerId: new mongoose_2.Types.ObjectId(sellerId),
            status: review_schema_js_1.ReviewStatus.APPROVED,
        })
            .populate('reviewerId', 'profile.firstName profile.lastName profile.avatar')
            .populate('productListingId', 'title')
            .sort({ createdAt: -1 })
            .exec();
        const averageRating = await this.calculateAverageRating(sellerId);
        return {
            reviews,
            averageRating,
            totalReviews: reviews.length,
        };
    }
    async calculateAverageRating(sellerId) {
        const result = await this.reviewModel
            .aggregate([
            {
                $match: {
                    sellerId: new mongoose_2.Types.ObjectId(sellerId),
                    status: review_schema_js_1.ReviewStatus.APPROVED,
                },
            },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                },
            },
        ])
            .exec();
        if (!result.length) {
            return 0;
        }
        return Math.round(result[0].averageRating * 10) / 10;
    }
    containsProhibitedContent(text) {
        const lowerText = text.toLowerCase();
        return PROHIBITED_WORDS.some((word) => lowerText.includes(word));
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(review_schema_js_1.Review.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __param(2, (0, mongoose_1.InjectModel)('Conversation')),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map