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
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const favorite_schema_js_1 = require("./schemas/favorite.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
let FavoritesService = class FavoritesService {
    favoriteModel;
    listingModel;
    constructor(favoriteModel, listingModel) {
        this.favoriteModel = favoriteModel;
        this.listingModel = listingModel;
    }
    async addFavorite(userId, productListingId) {
        if (!mongoose_2.Types.ObjectId.isValid(productListingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(productListingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        try {
            const favorite = new this.favoriteModel({
                userId: new mongoose_2.Types.ObjectId(userId),
                productListingId: new mongoose_2.Types.ObjectId(productListingId),
            });
            const saved = await favorite.save();
            await this.listingModel
                .updateOne({ _id: new mongoose_2.Types.ObjectId(productListingId) }, { $inc: { favoriteCount: 1 } })
                .exec();
            return saved;
        }
        catch (error) {
            if (error.code === 11000) {
                throw new common_1.ConflictException('Listing is already in your favorites');
            }
            throw error;
        }
    }
    async getUserFavorites(userId) {
        return this.favoriteModel
            .find({ userId: new mongoose_2.Types.ObjectId(userId) })
            .populate({
            path: 'productListingId',
            select: 'title price status images condition location createdAt isFeatured',
        })
            .sort({ createdAt: -1 })
            .exec();
    }
    async removeFavorite(favoriteId, userId) {
        if (!mongoose_2.Types.ObjectId.isValid(favoriteId)) {
            throw new common_1.NotFoundException('Favorite not found');
        }
        const favorite = await this.favoriteModel.findById(favoriteId).exec();
        if (!favorite) {
            throw new common_1.NotFoundException('Favorite not found');
        }
        if (favorite.userId.toString() !== userId) {
            throw new common_1.ForbiddenException('You are not authorized to remove this favorite');
        }
        await this.favoriteModel.deleteOne({ _id: favorite._id }).exec();
        await this.listingModel
            .updateOne({ _id: favorite.productListingId }, { $inc: { favoriteCount: -1 } })
            .exec();
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(favorite_schema_js_1.Favorite.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map