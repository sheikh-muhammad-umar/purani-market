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
exports.UserSchema = exports.User = exports.DeviceToken = exports.NotificationPreferences = exports.MfaSettings = exports.SocialLogin = exports.VerificationChangeCount = exports.PendingPhoneChange = exports.PendingEmailChange = exports.UserProfile = exports.UserLocation = exports.UserStatus = exports.UserRole = void 0;
const mongoose_1 = require("@nestjs/mongoose");
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["USER"] = "user";
    UserRole["SELLER"] = "seller";
    UserRole["BUYER"] = "buyer";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["SUSPENDED"] = "suspended";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
let UserLocation = class UserLocation {
    type;
    coordinates;
};
exports.UserLocation = UserLocation;
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: 'Point' }),
    __metadata("design:type", String)
], UserLocation.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Number], default: [0, 0] }),
    __metadata("design:type", Array)
], UserLocation.prototype, "coordinates", void 0);
exports.UserLocation = UserLocation = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], UserLocation);
let UserProfile = class UserProfile {
    firstName;
    lastName;
    avatar;
    location;
    city;
    postalCode;
};
exports.UserProfile = UserProfile;
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], UserProfile.prototype, "firstName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], UserProfile.prototype, "lastName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], UserProfile.prototype, "avatar", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: UserLocation }),
    __metadata("design:type", UserLocation)
], UserProfile.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], UserProfile.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], UserProfile.prototype, "postalCode", void 0);
exports.UserProfile = UserProfile = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], UserProfile);
let PendingEmailChange = class PendingEmailChange {
    newEmail;
    verificationToken;
    expiresAt;
};
exports.PendingEmailChange = PendingEmailChange;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "newEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "verificationToken", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], PendingEmailChange.prototype, "expiresAt", void 0);
exports.PendingEmailChange = PendingEmailChange = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PendingEmailChange);
let PendingPhoneChange = class PendingPhoneChange {
    newPhone;
    otpHash;
    expiresAt;
    attempts;
};
exports.PendingPhoneChange = PendingPhoneChange;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PendingPhoneChange.prototype, "newPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PendingPhoneChange.prototype, "otpHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, required: true }),
    __metadata("design:type", Date)
], PendingPhoneChange.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], PendingPhoneChange.prototype, "attempts", void 0);
exports.PendingPhoneChange = PendingPhoneChange = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], PendingPhoneChange);
let VerificationChangeCount = class VerificationChangeCount {
    count;
    resetAt;
};
exports.VerificationChangeCount = VerificationChangeCount;
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], VerificationChangeCount.prototype, "count", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], VerificationChangeCount.prototype, "resetAt", void 0);
exports.VerificationChangeCount = VerificationChangeCount = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], VerificationChangeCount);
let SocialLogin = class SocialLogin {
    provider;
    providerId;
};
exports.SocialLogin = SocialLogin;
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: ['google', 'facebook'], required: true }),
    __metadata("design:type", String)
], SocialLogin.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], SocialLogin.prototype, "providerId", void 0);
exports.SocialLogin = SocialLogin = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], SocialLogin);
let MfaSettings = class MfaSettings {
    enabled;
    totpSecret;
    failedAttempts;
    lockedUntil;
};
exports.MfaSettings = MfaSettings;
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], MfaSettings.prototype, "enabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], MfaSettings.prototype, "totpSecret", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], MfaSettings.prototype, "failedAttempts", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], MfaSettings.prototype, "lockedUntil", void 0);
exports.MfaSettings = MfaSettings = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], MfaSettings);
let NotificationPreferences = class NotificationPreferences {
    messages;
    offers;
    productUpdates;
    promotions;
    packageAlerts;
};
exports.NotificationPreferences = NotificationPreferences;
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "messages", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "offers", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "productUpdates", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "promotions", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "packageAlerts", void 0);
exports.NotificationPreferences = NotificationPreferences = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], NotificationPreferences);
let DeviceToken = class DeviceToken {
    platform;
    token;
};
exports.DeviceToken = DeviceToken;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], DeviceToken.prototype, "platform", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], DeviceToken.prototype, "token", void 0);
exports.DeviceToken = DeviceToken = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], DeviceToken);
let User = class User {
    _id;
    email;
    phone;
    passwordHash;
    role;
    profile;
    emailVerified;
    phoneVerified;
    pendingEmailChange;
    pendingPhoneChange;
    verificationChangeCount;
    socialLogins;
    mfa;
    notificationPreferences;
    deviceTokens;
    adLimit;
    activeAdCount;
    status;
    lastLoginAt;
    lastLoginDevice;
    createdAt;
    updatedAt;
};
exports.User = User;
__decorate([
    (0, mongoose_1.Prop)({ type: String, unique: true, sparse: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, unique: true, sparse: true }),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: UserRole, default: UserRole.USER }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: UserProfile, default: () => ({}) }),
    __metadata("design:type", UserProfile)
], User.prototype, "profile", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "phoneVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: PendingEmailChange }),
    __metadata("design:type", PendingEmailChange)
], User.prototype, "pendingEmailChange", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: PendingPhoneChange }),
    __metadata("design:type", PendingPhoneChange)
], User.prototype, "pendingPhoneChange", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: VerificationChangeCount, default: () => ({}) }),
    __metadata("design:type", VerificationChangeCount)
], User.prototype, "verificationChangeCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [SocialLogin], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "socialLogins", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: MfaSettings, default: () => ({}) }),
    __metadata("design:type", MfaSettings)
], User.prototype, "mfa", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: NotificationPreferences, default: () => ({}) }),
    __metadata("design:type", NotificationPreferences)
], User.prototype, "notificationPreferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [DeviceToken], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "deviceTokens", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 10 }),
    __metadata("design:type", Number)
], User.prototype, "adLimit", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "activeAdCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: UserStatus, default: UserStatus.ACTIVE }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date }),
    __metadata("design:type", Date)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], User.prototype, "lastLoginDevice", void 0);
exports.User = User = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'users' })
], User);
exports.UserSchema = mongoose_1.SchemaFactory.createForClass(User);
exports.UserSchema.index({ email: 1 });
exports.UserSchema.index({ phone: 1 });
exports.UserSchema.index({ 'socialLogins.provider': 1, 'socialLogins.providerId': 1 });
//# sourceMappingURL=user.schema.js.map