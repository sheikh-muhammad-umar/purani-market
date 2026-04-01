"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const ioredis_1 = require("@nestjs-modules/ioredis");
const ioredis_2 = __importDefault(require("ioredis"));
const mongoose_2 = require("mongoose");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const otplib_1 = require("otplib");
const QRCode = __importStar(require("qrcode"));
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const verification_token_schema_js_1 = require("./schemas/verification-token.schema.js");
const social_login_dto_js_1 = require("./dto/social-login.dto.js");
const email_service_js_1 = require("./services/email.service.js");
const sms_service_js_1 = require("./services/sms.service.js");
const google_auth_library_1 = require("google-auth-library");
const BCRYPT_COST_FACTOR = 12;
const EMAIL_TOKEN_EXPIRY_HOURS = 24;
const PHONE_OTP_EXPIRY_MINUTES = 10;
const MAX_RESENDS_PER_HOUR = 5;
const UNVERIFIED_REMINDER_HOURS = 24;
const MFA_MAX_FAILED_ATTEMPTS = 5;
const MFA_FAILED_WINDOW_MINUTES = 15;
const MFA_LOCKOUT_MINUTES = 30;
const MFA_ISSUER = 'OnlineMarketplace';
const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const EMAIL_CHANGE_EXPIRY_HOURS = 24;
const PHONE_CHANGE_OTP_EXPIRY_MINUTES = 10;
const MAX_CHANGE_REQUESTS_PER_DAY = 3;
let AuthService = AuthService_1 = class AuthService {
    userModel;
    verificationTokenModel;
    emailService;
    smsService;
    jwtService;
    configService;
    redis;
    logger = new common_1.Logger(AuthService_1.name);
    accessExpiration;
    refreshExpiration;
    googleClient;
    constructor(userModel, verificationTokenModel, emailService, smsService, jwtService, configService, redis) {
        this.userModel = userModel;
        this.verificationTokenModel = verificationTokenModel;
        this.emailService = emailService;
        this.smsService = smsService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.redis = redis;
        this.accessExpiration =
            this.configService.get('jwt.accessExpiration') ?? '15m';
        this.refreshExpiration =
            this.configService.get('jwt.refreshExpiration') ?? '7d';
        this.googleClient = new google_auth_library_1.OAuth2Client(this.configService.get('google.clientId'));
    }
    async register(dto) {
        if (!dto.email && !dto.phone) {
            throw new common_1.BadRequestException('Either email or phone is required');
        }
        if (dto.email) {
            const existingEmail = await this.userModel.findOne({ email: dto.email }).exec();
            if (existingEmail) {
                throw new common_1.ConflictException('Email is already registered');
            }
        }
        if (dto.phone) {
            const existingPhone = await this.userModel.findOne({ phone: dto.phone }).exec();
            if (existingPhone) {
                throw new common_1.ConflictException('Phone number is already registered');
            }
        }
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);
        const user = await this.userModel.create({
            email: dto.email || undefined,
            phone: dto.phone || undefined,
            passwordHash,
            emailVerified: false,
            phoneVerified: false,
            profile: {
                firstName: dto.firstName || '',
                lastName: dto.lastName || '',
            },
        });
        if (dto.email) {
            await this.sendEmailVerification(user._id, dto.email);
            return {
                message: 'Registration successful. Please check your email for verification.',
                userId: user._id.toString(),
            };
        }
        else {
            await this.sendPhoneVerification(user._id, dto.phone);
            return {
                message: 'Registration successful. Please check your phone for the OTP code.',
                userId: user._id.toString(),
            };
        }
    }
    async verifyEmail(token) {
        const record = await this.verificationTokenModel.findOne({
            token,
            type: verification_token_schema_js_1.VerificationType.EMAIL,
            used: false,
        }).exec();
        if (!record) {
            throw new common_1.BadRequestException('Invalid or expired verification token');
        }
        if (record.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Verification token has expired');
        }
        record.used = true;
        await record.save();
        await this.userModel.findByIdAndUpdate(record.userId, {
            emailVerified: true,
        }).exec();
        return { message: 'Email verified successfully' };
    }
    async verifyPhone(phone, otp) {
        const user = await this.userModel.findOne({ phone }).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const record = await this.verificationTokenModel.findOne({
            userId: user._id,
            type: verification_token_schema_js_1.VerificationType.PHONE,
            used: false,
        }).sort({ createdAt: -1 }).exec();
        if (!record) {
            throw new common_1.BadRequestException('Invalid or expired OTP');
        }
        if (record.expiresAt < new Date()) {
            throw new common_1.BadRequestException('OTP has expired');
        }
        const isValid = await bcrypt.compare(otp, record.token);
        if (!isValid) {
            throw new common_1.BadRequestException('Invalid OTP code');
        }
        record.used = true;
        await record.save();
        await this.userModel.findByIdAndUpdate(user._id, {
            phoneVerified: true,
        }).exec();
        return { message: 'Phone number verified successfully' };
    }
    async resendVerification(email, phone) {
        if (!email && !phone) {
            throw new common_1.BadRequestException('Either email or phone is required');
        }
        let user;
        if (email) {
            user = await this.userModel.findOne({ email }).exec();
        }
        else {
            user = await this.userModel.findOne({ phone }).exec();
        }
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (email && user.emailVerified) {
            throw new common_1.BadRequestException('Email is already verified');
        }
        if (phone && user.phoneVerified) {
            throw new common_1.BadRequestException('Phone is already verified');
        }
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await this.verificationTokenModel.countDocuments({
            userId: user._id,
            type: email ? verification_token_schema_js_1.VerificationType.EMAIL : verification_token_schema_js_1.VerificationType.PHONE,
            createdAt: { $gte: oneHourAgo },
        }).exec();
        if (recentCount >= MAX_RESENDS_PER_HOUR) {
            throw new common_1.BadRequestException('Maximum resend limit reached. Please try again later.');
        }
        await this.verificationTokenModel.updateMany({
            userId: user._id,
            type: email ? verification_token_schema_js_1.VerificationType.EMAIL : verification_token_schema_js_1.VerificationType.PHONE,
            used: false,
        }, { used: true }).exec();
        if (email) {
            await this.sendEmailVerification(user._id, email);
        }
        else {
            await this.sendPhoneVerification(user._id, phone);
        }
        return { message: 'Verification sent successfully' };
    }
    async checkUnverifiedAccounts() {
        const reminderThreshold = new Date(Date.now() - UNVERIFIED_REMINDER_HOURS * 60 * 60 * 1000);
        const unverifiedUsers = await this.userModel.find({
            $or: [
                { email: { $exists: true }, emailVerified: false },
                { phone: { $exists: true }, phoneVerified: false },
            ],
            createdAt: { $lte: reminderThreshold },
        }).exec();
        for (const user of unverifiedUsers) {
            if (user.email && !user.emailVerified) {
                await this.emailService.sendReminderEmail(user.email);
            }
            if (user.phone && !user.phoneVerified) {
                await this.smsService.sendReminderSms(user.phone);
            }
        }
        this.logger.log(`Sent reminders to ${unverifiedUsers.length} unverified accounts`);
    }
    async login(email, phone, password, userAgent) {
        if (!email && !phone) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        let user = null;
        if (email) {
            user = await this.userModel.findOne({ email }).exec();
        }
        else if (phone) {
            user = await this.userModel.findOne({ phone }).exec();
        }
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.mfa?.enabled) {
            return {
                mfaRequired: true,
                userId: user._id.toString(),
            };
        }
        await this.userModel.findByIdAndUpdate(user._id, {
            lastLoginAt: new Date(),
            lastLoginDevice: userAgent || 'unknown',
        }).exec();
        const tokens = await this.generateTokens(user);
        const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
        await this.redis.set(`rt:${tokens.refreshJti}`, user._id.toString(), 'EX', refreshTtl);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user._id.toString(),
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        };
    }
    async socialLogin(dto) {
        const { provider, token } = dto;
        let providerEmail;
        let providerId;
        let firstName = '';
        let lastName = '';
        if (provider === social_login_dto_js_1.SocialProvider.GOOGLE) {
            const payload = await this.verifyGoogleToken(token);
            providerEmail = payload.email;
            providerId = payload.sub;
            firstName = payload.firstName;
            lastName = payload.lastName;
        }
        else if (provider === social_login_dto_js_1.SocialProvider.FACEBOOK) {
            const payload = await this.verifyFacebookToken(token);
            providerEmail = payload.email;
            providerId = payload.id;
            firstName = payload.firstName;
            lastName = payload.lastName;
        }
        else {
            throw new common_1.BadRequestException('Unsupported social login provider');
        }
        let user = await this.userModel.findOne({
            'socialLogins.provider': provider,
            'socialLogins.providerId': providerId,
        }).exec();
        if (!user) {
            user = await this.userModel.findOne({ email: providerEmail }).exec();
            if (user) {
                user.socialLogins.push({ provider, providerId });
                if (!user.emailVerified) {
                    user.emailVerified = true;
                }
                await user.save();
            }
            else {
                user = await this.userModel.create({
                    email: providerEmail,
                    emailVerified: true,
                    socialLogins: [{ provider, providerId }],
                    profile: { firstName, lastName },
                });
            }
        }
        await this.userModel.findByIdAndUpdate(user._id, {
            lastLoginAt: new Date(),
            lastLoginDevice: `social:${provider}`,
        }).exec();
        const tokens = await this.generateTokens(user);
        const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
        await this.redis.set(`rt:${tokens.refreshJti}`, user._id.toString(), 'EX', refreshTtl);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user._id.toString(),
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        };
    }
    async verifyGoogleToken(idToken) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: this.configService.get('google.clientId'),
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new common_1.UnauthorizedException('Google token missing email');
            }
            return {
                email: payload.email,
                sub: payload.sub,
                firstName: payload.given_name || '',
                lastName: payload.family_name || '',
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException)
                throw error;
            throw new common_1.UnauthorizedException('Invalid Google token');
        }
    }
    async verifyFacebookToken(accessToken) {
        try {
            const response = await fetch(`https://graph.facebook.com/me?fields=id,email,first_name,last_name&access_token=${encodeURIComponent(accessToken)}`);
            if (!response.ok) {
                throw new common_1.UnauthorizedException('Invalid Facebook token');
            }
            const data = (await response.json());
            if (!data.id || !data.email) {
                throw new common_1.UnauthorizedException('Facebook token missing required fields');
            }
            return {
                email: data.email,
                id: data.id,
                firstName: data.first_name || '',
                lastName: data.last_name || '',
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException)
                throw error;
            throw new common_1.UnauthorizedException('Invalid Facebook token');
        }
    }
    async refreshToken(refreshToken) {
        let payload;
        try {
            payload = this.jwtService.verify(refreshToken);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        if (payload.type !== 'refresh') {
            throw new common_1.UnauthorizedException('Invalid token type');
        }
        const storedUserId = await this.redis.get(`rt:${payload.jti}`);
        if (!storedUserId) {
            throw new common_1.UnauthorizedException('Refresh token has been revoked');
        }
        const user = await this.userModel.findById(payload.sub).exec();
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        await this.redis.del(`rt:${payload.jti}`);
        const tokens = await this.generateTokens(user);
        const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
        await this.redis.set(`rt:${tokens.refreshJti}`, user._id.toString(), 'EX', refreshTtl);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    async logout(accessToken, userId) {
        let payload;
        try {
            payload = this.jwtService.verify(accessToken);
        }
        catch {
            try {
                payload = this.jwtService.decode(accessToken);
            }
            catch {
                throw new common_1.UnauthorizedException('Invalid token');
            }
        }
        if (payload && payload.jti) {
            const accessTtl = this.parseExpirationToSeconds(this.accessExpiration);
            await this.redis.set(`bl:${payload.jti}`, '1', 'EX', accessTtl);
        }
        this.logger.log(`User ${userId} logged out`);
        return { message: 'Logged out successfully' };
    }
    async enableMfa(userId) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.mfa?.enabled) {
            throw new common_1.BadRequestException('MFA is already enabled');
        }
        const secret = (0, otplib_1.generateSecret)();
        const label = user.email || user.phone || userId;
        const otpauthUrl = (0, otplib_1.generateURI)({ label, issuer: MFA_ISSUER, secret });
        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
        await this.userModel.findByIdAndUpdate(userId, {
            'mfa.totpSecret': secret,
            'mfa.enabled': true,
            'mfa.failedAttempts': 0,
            'mfa.lockedUntil': null,
        }).exec();
        return { secret, qrCodeUrl };
    }
    async verifyMfa(userId, code, userAgent) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.mfa?.enabled || !user.mfa?.totpSecret) {
            throw new common_1.BadRequestException('MFA is not enabled for this account');
        }
        if (user.mfa.lockedUntil && user.mfa.lockedUntil > new Date()) {
            const remainingMs = user.mfa.lockedUntil.getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            throw new common_1.ForbiddenException(`Account is temporarily locked. Try again in ${remainingMin} minutes.`);
        }
        let isValid = false;
        try {
            const verifyResult = (0, otplib_1.verifySync)({
                token: code,
                secret: user.mfa.totpSecret,
            });
            isValid = verifyResult.valid;
        }
        catch {
            isValid = false;
        }
        if (!isValid) {
            const windowStart = new Date(Date.now() - MFA_FAILED_WINDOW_MINUTES * 60 * 1000);
            const failedAttempts = (user.mfa.failedAttempts || 0) + 1;
            const updateFields = {
                'mfa.failedAttempts': failedAttempts,
            };
            if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
                updateFields['mfa.lockedUntil'] = new Date(Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000);
                updateFields['mfa.failedAttempts'] = 0;
            }
            await this.userModel.findByIdAndUpdate(userId, updateFields).exec();
            if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
                throw new common_1.ForbiddenException(`Account locked for ${MFA_LOCKOUT_MINUTES} minutes due to too many failed attempts.`);
            }
            throw new common_1.UnauthorizedException('Invalid MFA code');
        }
        await this.userModel.findByIdAndUpdate(userId, {
            'mfa.failedAttempts': 0,
            'mfa.lockedUntil': null,
            lastLoginAt: new Date(),
            lastLoginDevice: userAgent || 'unknown',
        }).exec();
        const tokens = await this.generateTokens(user);
        const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
        await this.redis.set(`rt:${tokens.refreshJti}`, user._id.toString(), 'EX', refreshTtl);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user._id.toString(),
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        };
    }
    async forgotPassword(email) {
        const genericMessage = 'If an account with that email exists, a password reset link has been sent.';
        const user = await this.userModel.findOne({ email }).exec();
        if (!user) {
            return { message: genericMessage };
        }
        await this.verificationTokenModel.updateMany({
            userId: user._id,
            type: verification_token_schema_js_1.VerificationType.PASSWORD_RESET,
            used: false,
        }, { used: true }).exec();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);
        await this.verificationTokenModel.create({
            userId: user._id,
            type: verification_token_schema_js_1.VerificationType.PASSWORD_RESET,
            token,
            expiresAt,
        });
        await this.emailService.sendPasswordResetEmail(email, token);
        return { message: genericMessage };
    }
    async resetPassword(token, newPassword) {
        const record = await this.verificationTokenModel.findOne({
            token,
            type: verification_token_schema_js_1.VerificationType.PASSWORD_RESET,
            used: false,
        }).exec();
        if (!record) {
            throw new common_1.BadRequestException('Invalid or expired password reset token');
        }
        if (record.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Password reset token has expired');
        }
        record.used = true;
        await record.save();
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);
        await this.userModel.findByIdAndUpdate(record.userId, {
            passwordHash,
        }).exec();
        await this.invalidateAllSessions(record.userId.toString());
        return { message: 'Password has been reset successfully' };
    }
    async invalidateAllSessions(userId) {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'rt:*', 'COUNT', 100);
            cursor = nextCursor;
            for (const key of keys) {
                const storedUserId = await this.redis.get(key);
                if (storedUserId === userId) {
                    await this.redis.del(key);
                }
            }
        } while (cursor !== '0');
    }
    async requestEmailChange(userId, newEmail) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const existing = await this.userModel.findOne({ email: newEmail }).exec();
        if (existing) {
            throw new common_1.ConflictException('Email is already in use');
        }
        this.enforceChangeRateLimit(user);
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRY_HOURS * 60 * 60 * 1000);
        await this.userModel.findByIdAndUpdate(userId, {
            pendingEmailChange: { newEmail, verificationToken: token, expiresAt },
            $inc: { 'verificationChangeCount.count': 1 },
        }).exec();
        await this.emailService.sendEmailChangeVerification(newEmail, token);
        return { message: 'Verification link sent to new email address' };
    }
    async verifyEmailChange(token) {
        const user = await this.userModel.findOne({
            'pendingEmailChange.verificationToken': token,
        }).exec();
        if (!user || !user.pendingEmailChange) {
            throw new common_1.BadRequestException('Invalid or expired email change token');
        }
        if (user.pendingEmailChange.expiresAt < new Date()) {
            await this.userModel.findByIdAndUpdate(user._id, {
                $unset: { pendingEmailChange: 1 },
            }).exec();
            throw new common_1.BadRequestException('Email change token has expired');
        }
        const existing = await this.userModel.findOne({
            email: user.pendingEmailChange.newEmail,
            _id: { $ne: user._id },
        }).exec();
        if (existing) {
            throw new common_1.ConflictException('Email is already in use');
        }
        const oldEmail = user.email;
        const newEmail = user.pendingEmailChange.newEmail;
        await this.userModel.findByIdAndUpdate(user._id, {
            email: newEmail,
            emailVerified: true,
            $unset: { pendingEmailChange: 1 },
        }).exec();
        await this.invalidateAllSessions(user._id.toString());
        if (oldEmail) {
            await this.emailService.sendEmailChangeNotification(oldEmail);
        }
        return { message: 'Email updated successfully' };
    }
    async requestPhoneChange(userId, newPhone) {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const existing = await this.userModel.findOne({ phone: newPhone }).exec();
        if (existing) {
            throw new common_1.ConflictException('Phone number is already in use');
        }
        this.enforceChangeRateLimit(user);
        const otp = this.generateOtp();
        const otpHash = await bcrypt.hash(otp, BCRYPT_COST_FACTOR);
        const expiresAt = new Date(Date.now() + PHONE_CHANGE_OTP_EXPIRY_MINUTES * 60 * 1000);
        await this.userModel.findByIdAndUpdate(userId, {
            pendingPhoneChange: { newPhone, otpHash, expiresAt, attempts: 0 },
            $inc: { 'verificationChangeCount.count': 1 },
        }).exec();
        await this.smsService.sendOtp(newPhone, otp);
        return { message: 'OTP sent to new phone number' };
    }
    async verifyPhoneChange(userId, otp) {
        const user = await this.userModel.findById(userId).exec();
        if (!user || !user.pendingPhoneChange) {
            throw new common_1.BadRequestException('No pending phone change request');
        }
        if (user.pendingPhoneChange.expiresAt < new Date()) {
            await this.userModel.findByIdAndUpdate(user._id, {
                $unset: { pendingPhoneChange: 1 },
            }).exec();
            throw new common_1.BadRequestException('Phone change OTP has expired');
        }
        const isValid = await bcrypt.compare(otp, user.pendingPhoneChange.otpHash);
        if (!isValid) {
            await this.userModel.findByIdAndUpdate(user._id, {
                $inc: { 'pendingPhoneChange.attempts': 1 },
            }).exec();
            throw new common_1.BadRequestException('Invalid OTP code');
        }
        const existing = await this.userModel.findOne({
            phone: user.pendingPhoneChange.newPhone,
            _id: { $ne: user._id },
        }).exec();
        if (existing) {
            throw new common_1.ConflictException('Phone number is already in use');
        }
        const newPhone = user.pendingPhoneChange.newPhone;
        await this.userModel.findByIdAndUpdate(user._id, {
            phone: newPhone,
            phoneVerified: true,
            $unset: { pendingPhoneChange: 1 },
        }).exec();
        await this.invalidateAllSessions(user._id.toString());
        return { message: 'Phone number updated successfully' };
    }
    enforceChangeRateLimit(user) {
        const changeCount = user.verificationChangeCount;
        if (changeCount && changeCount.count >= MAX_CHANGE_REQUESTS_PER_DAY) {
            if (changeCount.resetAt && changeCount.resetAt > new Date()) {
                throw new common_1.BadRequestException('Maximum change requests reached. Please try again later.');
            }
        }
    }
    isUserVerified(user) {
        if (user.email && !user.emailVerified)
            return false;
        if (user.phone && !user.phoneVerified)
            return false;
        return true;
    }
    async sendEmailVerification(userId, email) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        await this.verificationTokenModel.create({
            userId,
            type: verification_token_schema_js_1.VerificationType.EMAIL,
            token,
            expiresAt,
        });
        await this.emailService.sendVerificationEmail(email, token);
    }
    async sendPhoneVerification(userId, phone) {
        const otp = this.generateOtp();
        const otpHash = await bcrypt.hash(otp, BCRYPT_COST_FACTOR);
        const expiresAt = new Date(Date.now() + PHONE_OTP_EXPIRY_MINUTES * 60 * 1000);
        await this.verificationTokenModel.create({
            userId,
            type: verification_token_schema_js_1.VerificationType.PHONE,
            token: otpHash,
            expiresAt,
        });
        await this.smsService.sendOtp(phone, otp);
    }
    generateOtp() {
        const num = crypto.randomInt(0, 1000000);
        return num.toString().padStart(6, '0');
    }
    async generateTokens(user) {
        const accessJti = crypto.randomUUID();
        const refreshJti = crypto.randomUUID();
        const accessPayload = {
            sub: user._id.toString(),
            email: user.email,
            phone: user.phone,
            role: user.role,
            type: 'access',
            jti: accessJti,
        };
        const refreshPayload = {
            sub: user._id.toString(),
            email: user.email,
            phone: user.phone,
            role: user.role,
            type: 'refresh',
            jti: refreshJti,
        };
        const accessToken = this.jwtService.sign({ ...accessPayload }, { expiresIn: this.accessExpiration });
        const refreshToken = this.jwtService.sign({ ...refreshPayload }, { expiresIn: this.refreshExpiration });
        return { accessToken, refreshToken, refreshJti };
    }
    parseExpirationToSeconds(expiration) {
        const match = expiration.match(/^(\d+)([smhd])$/);
        if (!match)
            return 900;
        const value = parseInt(match[1], 10);
        switch (match[2]) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 3600;
            case 'd': return value * 86400;
            default: return 900;
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(verification_token_schema_js_1.VerificationToken.name)),
    __param(6, (0, ioredis_1.InjectRedis)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        email_service_js_1.EmailService,
        sms_service_js_1.SmsService,
        jwt_1.JwtService,
        config_1.ConfigService,
        ioredis_2.default])
], AuthService);
//# sourceMappingURL=auth.service.js.map