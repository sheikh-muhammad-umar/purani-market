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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductListingSchema = exports.ProductListing = exports.ListingContactInfo = exports.ListingLocation = exports.ListingVideo = exports.ListingImage = exports.ListingPrice = exports.ListingStatus = exports.ListingCondition = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var ListingCondition;
(function (ListingCondition) {
    ListingCondition["NEW"] = "new";
    ListingCondition["USED"] = "used";
    ListingCondition["REFURBISHED"] = "refurbished";
})(ListingCondition || (exports.ListingCondition = ListingCondition = {}));
var ListingStatus;
(function (ListingStatus) {
    ListingStatus["ACTIVE"] = "active";
    ListingStatus["INACTIVE"] = "inactive";
    ListingStatus["PENDING_REVIEW"] = "pending_review";
    ListingStatus["REJECTED"] = "rejected";
    ListingStatus["SOLD"] = "sold";
    ListingStatus["RESERVED"] = "reserved";
    ListingStatus["DELETED"] = "deleted";
})(ListingStatus || (exports.ListingStatus = ListingStatus = {}));
let ListingPrice = class ListingPrice {
    amount;
    currency;
};
exports.ListingPrice = ListingPrice;
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], ListingPrice.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: 'PKR' }),
    __metadata("design:type", String)
], ListingPrice.prototype, "currency", void 0);
exports.ListingPrice = ListingPrice = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ListingPrice);
let ListingImage = class ListingImage {
    url;
    thumbnailUrl;
    sortOrder;
};
exports.ListingImage = ListingImage;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], ListingImage.prototype, "url", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingImage.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ListingImage.prototype, "sortOrder", void 0);
exports.ListingImage = ListingImage = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ListingImage);
let ListingVideo = class ListingVideo {
    url;
    thumbnailUrl;
};
exports.ListingVideo = ListingVideo;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], ListingVideo.prototype, "url", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingVideo.prototype, "thumbnailUrl", void 0);
exports.ListingVideo = ListingVideo = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ListingVideo);
let ListingLocation = class ListingLocation {
    type;
    coordinates;
    city;
    area;
};
exports.ListingLocation = ListingLocation;
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingLocation.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Number] }),
    __metadata("design:type", Array)
], ListingLocation.prototype, "coordinates", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingLocation.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingLocation.prototype, "area", void 0);
exports.ListingLocation = ListingLocation = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ListingLocation);
let ListingContactInfo = class ListingContactInfo {
    phone;
    email;
};
exports.ListingContactInfo = ListingContactInfo;
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingContactInfo.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ListingContactInfo.prototype, "email", void 0);
exports.ListingContactInfo = ListingContactInfo = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ListingContactInfo);
let ProductListing = class ProductListing {
    _id;
    sellerId;
    title;
    description;
    price;
    categoryId;
    categoryPath;
    condition;
    categoryAttributes;
    selectedFeatures;
    images;
    video;
    location;
    contactInfo;
    status;
    isFeatured;
    featuredUntil;
    rejectionReason;
    viewCount;
    favoriteCount;
    deletedAt;
    createdAt;
    updatedAt;
};
exports.ProductListing = ProductListing;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ProductListing.prototype, "sellerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, maxlength: 150 }),
    __metadata("design:type", String)
], ProductListing.prototype, "title", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, maxlength: 5000 }),
    __metadata("design:type", String)
], ProductListing.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ListingPrice, required: true }),
    __metadata("design:type", ListingPrice)
], ProductListing.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], ProductListing.prototype, "categoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose_2.Types.ObjectId], default: [] }),
    __metadata("design:type", Array)
], ProductListing.prototype, "categoryPath", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ListingCondition, required: true }),
    __metadata("design:type", String)
], ProductListing.prototype, "condition", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.Map, of: mongoose_2.Schema.Types.Mixed, default: () => new Map() }),
    __metadata("design:type", Map)
], ProductListing.prototype, "categoryAttributes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], ProductListing.prototype, "selectedFeatures", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [ListingImage],
        default: [],
        validate: {
            validator: (v) => v.length <= 20,
            message: 'A listing can have a maximum of 20 images',
        },
    }),
    __metadata("design:type", Array)
], ProductListing.prototype, "images", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ListingVideo, default: undefined }),
    __metadata("design:type", ListingVideo)
], ProductListing.prototype, "video", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ListingLocation }),
    __metadata("design:type", ListingLocation)
], ProductListing.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ListingContactInfo }),
    __metadata("design:type", ListingContactInfo)
], ProductListing.prototype, "contactInfo", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ListingStatus, default: ListingStatus.ACTIVE }),
    __metadata("design:type", String)
], ProductListing.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], ProductListing.prototype, "isFeatured", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], ProductListing.prototype, "featuredUntil", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], ProductListing.prototype, "rejectionReason", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ProductListing.prototype, "viewCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], ProductListing.prototype, "favoriteCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], ProductListing.prototype, "deletedAt", void 0);
exports.ProductListing = ProductListing = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'product_listings' })
], ProductListing);
exports.ProductListingSchema = mongoose_1.SchemaFactory.createForClass(ProductListing);
exports.ProductListingSchema.index({ sellerId: 1 });
exports.ProductListingSchema.index({ categoryId: 1 });
exports.ProductListingSchema.index({ status: 1 });
exports.ProductListingSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });
exports.ProductListingSchema.index({ isFeatured: -1, createdAt: -1 });
exports.ProductListingSchema.index({ createdAt: -1 });
exports.ProductListingSchema.index({ categoryPath: 1 });
//# sourceMappingURL=product-listing.schema.js.map