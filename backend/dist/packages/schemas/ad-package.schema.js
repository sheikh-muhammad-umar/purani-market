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
exports.AdPackageSchema = exports.AdPackage = exports.CategoryPricing = exports.AdPackageType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AdPackageType;
(function (AdPackageType) {
    AdPackageType["FEATURED_ADS"] = "featured_ads";
    AdPackageType["AD_SLOTS"] = "ad_slots";
})(AdPackageType || (exports.AdPackageType = AdPackageType = {}));
let CategoryPricing = class CategoryPricing {
    categoryId;
    price;
};
exports.CategoryPricing = CategoryPricing;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], CategoryPricing.prototype, "categoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], CategoryPricing.prototype, "price", void 0);
exports.CategoryPricing = CategoryPricing = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'ad_packages' })
], CategoryPricing);
let AdPackage = class AdPackage {
    _id;
    name;
    type;
    duration;
    quantity;
    defaultPrice;
    categoryPricing;
    isActive;
    createdAt;
    updatedAt;
};
exports.AdPackage = AdPackage;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], AdPackage.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: AdPackageType, required: true }),
    __metadata("design:type", String)
], AdPackage.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, enum: [7, 15, 30] }),
    __metadata("design:type", Number)
], AdPackage.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 1 }),
    __metadata("design:type", Number)
], AdPackage.prototype, "quantity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], AdPackage.prototype, "defaultPrice", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [{ categoryId: { type: mongoose_2.Types.ObjectId, ref: 'Category' }, price: Number }],
        default: [],
    }),
    __metadata("design:type", Array)
], AdPackage.prototype, "categoryPricing", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], AdPackage.prototype, "isActive", void 0);
exports.AdPackage = AdPackage = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'ad_packages' })
], AdPackage);
exports.AdPackageSchema = mongoose_1.SchemaFactory.createForClass(AdPackage);
exports.AdPackageSchema.index({ type: 1, duration: 1 });
exports.AdPackageSchema.index({ isActive: 1 });
//# sourceMappingURL=ad-package.schema.js.map