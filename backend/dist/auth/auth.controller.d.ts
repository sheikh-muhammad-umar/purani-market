import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { VerifyPhoneDto } from './dto/verify-phone.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SocialLoginDto } from './dto/social-login.dto.js';
import { VerifyMfaDto } from './dto/verify-mfa.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangeEmailDto } from './dto/change-email.dto.js';
import { VerifyEmailChangeDto } from './dto/verify-email-change.dto.js';
import { ChangePhoneDto } from './dto/change-phone.dto.js';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto.js';
interface AuthUser {
    sub: string;
    email?: string;
    phone?: string;
    role: string;
    type: string;
    jti: string;
}
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        message: string;
        userId: string;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        message: string;
    }>;
    verifyPhone(dto: VerifyPhoneDto): Promise<{
        message: string;
    }>;
    resendVerification(dto: ResendVerificationDto): Promise<{
        message: string;
    }>;
    login(dto: LoginDto, userAgent?: string): Promise<{
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
    enableMfa(user: AuthUser): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    verifyMfa(dto: VerifyMfaDto, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email?: string;
            phone?: string;
            role: string;
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    refreshToken(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(req: any, user: AuthUser): Promise<{
        message: string;
    }>;
    changeEmail(dto: ChangeEmailDto, user: AuthUser): Promise<{
        message: string;
    }>;
    verifyEmailChange(dto: VerifyEmailChangeDto): Promise<{
        message: string;
    }>;
    changePhone(dto: ChangePhoneDto, user: AuthUser): Promise<{
        message: string;
    }>;
    verifyPhoneChange(dto: VerifyPhoneChangeDto, user: AuthUser): Promise<{
        message: string;
    }>;
}
export {};
