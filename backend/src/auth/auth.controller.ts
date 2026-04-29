import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface AuthUser {
  sub: string;
  email?: string;
  phone?: string;
  role: string;
  type: string;
  jti: string;
}

@Controller('api/auth')
@UseGuards(CustomThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(dto.phone, dto.otp);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(
      dto.email,
      dto.phone,
      dto.channel,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(
      dto.email,
      dto.phone,
      dto.password,
      userAgent,
    );
  }

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto);
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async enableMfa(@CurrentUser() user: AuthUser) {
    return this.authService.enableMfa(user.sub);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifyMfa(dto.userId, dto.code, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any, @CurrentUser() user: AuthUser) {
    const authHeader = req.headers.authorization as string;
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.logout(token, user.sub);
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changeEmail(
    @Body() dto: ChangeEmailDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.requestEmailChange(user.sub, dto.newEmail);
  }

  /**
   * Verify email change via token from the verification link.
   * No JwtAuthGuard — the user clicks this link from their new email inbox,
   * so they may not have an active session. The token itself is the proof of ownership.
   */
  @Post('change-email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyEmailChange(@Body() dto: VerifyEmailChangeDto) {
    return this.authService.verifyEmailChange(dto.token);
  }

  @Post('change-phone')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePhone(
    @Body() dto: ChangePhoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.requestPhoneChange(user.sub, dto.newPhone);
  }

  @Post('change-phone/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async verifyPhoneChange(
    @Body() dto: VerifyPhoneChangeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.verifyPhoneChange(user.sub, dto.otp);
  }
}
