import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema.js';
import { VerificationTokenDocument } from './schemas/verification-token.schema.js';
import { RegisterDto } from './dto/register.dto.js';
import { SocialLoginDto } from './dto/social-login.dto.js';
import { EmailService } from './services/email.service.js';
import { SmsService } from './services/sms.service.js';
export declare class AuthService {
    private readonly userModel;
    private readonly verificationTokenModel;
    private readonly emailService;
    private readonly smsService;
    private readonly jwtService;
    private readonly configService;
    private readonly redis;
    private readonly logger;
    private readonly accessExpiration;
    private readonly refreshExpiration;
    private readonly googleClient;
    constructor(userModel: Model<UserDocument>, verificationTokenModel: Model<VerificationTokenDocument>, emailService: EmailService, smsService: SmsService, jwtService: JwtService, configService: ConfigService, redis: Redis);
    register(dto: RegisterDto): Promise<{
        message: string;
        userId: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    verifyPhone(phone: string, otp: string): Promise<{
        message: string;
    }>;
    resendVerification(email?: string, phone?: string): Promise<{
        message: string;
    }>;
    checkUnverifiedAccounts(): Promise<void>;
    login(email: string | undefined, phone: string | undefined, password: string, userAgent?: string): Promise<{
        accessToken?: string;
        refreshToken?: string;
        user?: {
            id: string;
            email?: string;
            phone?: string;
            role: string;
        };
        mfaRequired?: boolean;
        userId?: string;
    }>;
    socialLogin(dto: SocialLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email?: string;
            phone?: string;
            role: string;
        };
    }>;
    private verifyGoogleToken;
    private verifyFacebookToken;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(accessToken: string, userId: string): Promise<{
        message: string;
    }>;
    enableMfa(userId: string): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    verifyMfa(userId: string, code: string, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email?: string;
            phone?: string;
            role: string;
        };
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    invalidateAllSessions(userId: string): Promise<void>;
    requestEmailChange(userId: string, newEmail: string): Promise<{
        message: string;
    }>;
    verifyEmailChange(token: string): Promise<{
        message: string;
    }>;
    requestPhoneChange(userId: string, newPhone: string): Promise<{
        message: string;
    }>;
    verifyPhoneChange(userId: string, otp: string): Promise<{
        message: string;
    }>;
    private enforceChangeRateLimit;
    isUserVerified(user: UserDocument): boolean;
    private sendEmailVerification;
    private sendPhoneVerification;
    private generateOtp;
    private generateTokens;
    parseExpirationToSeconds(expiration: string): number;
}
