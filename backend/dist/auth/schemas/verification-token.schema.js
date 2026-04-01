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
exports.VerificationTokenSchema = exports.VerificationToken = exports.VerificationType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var VerificationType;
(function (VerificationType) {
    VerificationType["EMAIL"] = "email";
    VerificationType["PHONE"] = "phone";
    VerificationType["PASSWORD_RESET"] = "password_reset";
})(VerificationType || (exports.VerificationType = VerificationType = {}));
let VerificationToken = class VerificationToken {
    _id;
    userId;
    type;
    token;
    expiresAt;
    used;
    createdAt;
    updatedAt;
};
exports.VerificationToken = VerificationToken;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], VerificationToken.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: VerificationType, required: true }),
    __metadata("design:type", String)
], VerificationToken.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, index: true }),
    __metadata("design:type", String)
], VerificationToken.prototype, "token", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], VerificationToken.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], VerificationToken.prototype, "used", void 0);
exports.VerificationToken = VerificationToken = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'verification_tokens' })
], VerificationToken);
exports.VerificationTokenSchema = mongoose_1.SchemaFactory.createForClass(VerificationToken);
exports.VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
//# sourceMappingURL=verification-token.schema.js.map