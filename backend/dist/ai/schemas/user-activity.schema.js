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
exports.UserActivitySchema = exports.UserActivity = exports.UserAction = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var UserAction;
(function (UserAction) {
    UserAction["VIEW"] = "view";
    UserAction["SEARCH"] = "search";
    UserAction["FAVORITE"] = "favorite";
    UserAction["DISMISS"] = "dismiss";
    UserAction["CONTACT"] = "contact";
})(UserAction || (exports.UserAction = UserAction = {}));
let UserActivity = class UserActivity {
    _id;
    userId;
    action;
    productListingId;
    searchQuery;
    categoryId;
    metadata;
    createdAt;
    updatedAt;
};
exports.UserActivity = UserActivity;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserActivity.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: UserAction, required: true }),
    __metadata("design:type", String)
], UserActivity.prototype, "action", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'ProductListing' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserActivity.prototype, "productListingId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], UserActivity.prototype, "searchQuery", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], UserActivity.prototype, "categoryId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.Map, of: mongoose_2.Schema.Types.Mixed, default: () => new Map() }),
    __metadata("design:type", Map)
], UserActivity.prototype, "metadata", void 0);
exports.UserActivity = UserActivity = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'user_activities' })
], UserActivity);
exports.UserActivitySchema = mongoose_1.SchemaFactory.createForClass(UserActivity);
exports.UserActivitySchema.index({ userId: 1, createdAt: -1 });
exports.UserActivitySchema.index({ action: 1 });
exports.UserActivitySchema.index({ userId: 1, action: 1 });
//# sourceMappingURL=user-activity.schema.js.map