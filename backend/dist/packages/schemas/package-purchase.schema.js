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
exports.PackagePurchaseSchema = exports.PackagePurchase = exports.PaymentStatus = exports.PaymentMethod = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ad_package_schema_js_1 = require("./ad-package.schema.js");
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["JAZZCASH"] = "jazzcash";
    PaymentMethod["EASYPAISA"] = "easypaisa";
    PaymentMethod["CARD"] = "card";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["COMPLETED"] = "completed";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
let PackagePurchase = class PackagePurchase {
    _id;
    sellerId;
    packageId;
    categoryId;
    type;
    quantity;
    remainingQuantity;
    duration;
    price;
    paymentMethod;
    paymentStatus;
    paymentTransactionId;
    activatedAt;
    expiresAt;
    createdAt;
    updatedAt;
};
exports.PackagePurchase = PackagePurchase;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PackagePurchase.prototype, "sellerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'AdPackage', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PackagePurchase.prototype, "packageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category', default: null }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], PackagePurchase.prototype, "categoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ad_package_schema_js_1.AdPackageType, required: true }),
    __metadata("design:type", String)
], PackagePurchase.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 1 }),
    __metadata("design:type", Number)
], PackagePurchase.prototype, "quantity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], PackagePurchase.prototype, "remainingQuantity", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, enum: [7, 15, 30] }),
    __metadata("design:type", Number)
], PackagePurchase.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 0 }),
    __metadata("design:type", Number)
], PackagePurchase.prototype, "price", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: PaymentMethod, required: true }),
    __metadata("design:type", String)
], PackagePurchase.prototype, "paymentMethod", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING }),
    __metadata("design:type", String)
], PackagePurchase.prototype, "paymentStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: null }),
    __metadata("design:type", String)
], PackagePurchase.prototype, "paymentTransactionId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Date)
], PackagePurchase.prototype, "activatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: null }),
    __metadata("design:type", Date)
], PackagePurchase.prototype, "expiresAt", void 0);
exports.PackagePurchase = PackagePurchase = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'package_purchases' })
], PackagePurchase);
exports.PackagePurchaseSchema = mongoose_1.SchemaFactory.createForClass(PackagePurchase);
exports.PackagePurchaseSchema.index({ sellerId: 1 });
exports.PackagePurchaseSchema.index({ paymentStatus: 1 });
exports.PackagePurchaseSchema.index({ expiresAt: 1 });
//# sourceMappingURL=package-purchase.schema.js.map