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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_js_1 = require("./auth.service.js");
const register_dto_js_1 = require("./dto/register.dto.js");
const verify_email_dto_js_1 = require("./dto/verify-email.dto.js");
const verify_phone_dto_js_1 = require("./dto/verify-phone.dto.js");
const resend_verification_dto_js_1 = require("./dto/resend-verification.dto.js");
const login_dto_js_1 = require("./dto/login.dto.js");
const refresh_token_dto_js_1 = require("./dto/refresh-token.dto.js");
const social_login_dto_js_1 = require("./dto/social-login.dto.js");
const verify_mfa_dto_js_1 = require("./dto/verify-mfa.dto.js");
const forgot_password_dto_js_1 = require("./dto/forgot-password.dto.js");
const reset_password_dto_js_1 = require("./dto/reset-password.dto.js");
const change_email_dto_js_1 = require("./dto/change-email.dto.js");
const verify_email_change_dto_js_1 = require("./dto/verify-email-change.dto.js");
const change_phone_dto_js_1 = require("./dto/change-phone.dto.js");
const verify_phone_change_dto_js_1 = require("./dto/verify-phone-change.dto.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const throttler_guard_js_1 = require("../common/guards/throttler.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async register(dto) {
        return this.authService.register(dto);
    }
    async verifyEmail(dto) {
        return this.authService.verifyEmail(dto.token);
    }
    async verifyPhone(dto) {
        return this.authService.verifyPhone(dto.phone, dto.otp);
    }
    async resendVerification(dto) {
        return this.authService.resendVerification(dto.email, dto.phone);
    }
    async login(dto, userAgent) {
        return this.authService.login(dto.email, dto.phone, dto.password, userAgent);
    }
    async socialLogin(dto) {
        return this.authService.socialLogin(dto);
    }
    async enableMfa(user) {
        return this.authService.enableMfa(user.sub);
    }
    async verifyMfa(dto, userAgent) {
        return this.authService.verifyMfa(dto.userId, dto.code, userAgent);
    }
    async forgotPassword(dto) {
        return this.authService.forgotPassword(dto.email);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }
    async refreshToken(dto) {
        return this.authService.refreshToken(dto.refreshToken);
    }
    async logout(req, user) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        return this.authService.logout(token, user.sub);
    }
    async changeEmail(dto, user) {
        return this.authService.requestEmailChange(user.sub, dto.newEmail);
    }
    async verifyEmailChange(dto) {
        return this.authService.verifyEmailChange(dto.token);
    }
    async changePhone(dto, user) {
        return this.authService.requestPhoneChange(user.sub, dto.newPhone);
    }
    async verifyPhoneChange(dto, user) {
        return this.authService.verifyPhoneChange(user.sub, dto.otp);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_js_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_dto_js_1.VerifyEmailDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('verify-phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_phone_dto_js_1.VerifyPhoneDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyPhone", null);
__decorate([
    (0, common_1.Post)('resend-verification'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_verification_dto_js_1.ResendVerificationDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendVerification", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_js_1.LoginDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('social-login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [social_login_dto_js_1.SocialLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "socialLogin", null);
__decorate([
    (0, common_1.Post)('mfa/enable'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "enableMfa", null);
__decorate([
    (0, common_1.Post)('mfa/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_mfa_dto_js_1.VerifyMfaDto, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyMfa", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_js_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_js_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('refresh-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_js_1.RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshToken", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('change-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_email_dto_js_1.ChangeEmailDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changeEmail", null);
__decorate([
    (0, common_1.Post)('change-email/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_change_dto_js_1.VerifyEmailChangeDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmailChange", null);
__decorate([
    (0, common_1.Post)('change-phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_phone_dto_js_1.ChangePhoneDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePhone", null);
__decorate([
    (0, common_1.Post)('change-phone/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_phone_change_dto_js_1.VerifyPhoneChangeDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyPhoneChange", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/auth'),
    (0, common_1.UseGuards)(throttler_guard_js_1.CustomThrottlerGuard),
    __metadata("design:paramtypes", [auth_service_js_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map