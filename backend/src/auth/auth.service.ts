import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  generateSecret as generateTotpSecret,
  verifySync as verifyTotp,
  generateURI as generateTotpURI,
} from 'otplib';
import * as QRCode from 'qrcode';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { UserStatus } from '../common/enums/user-status.enum.js';
import {
  VerificationToken,
  VerificationTokenDocument,
  VerificationType,
} from './schemas/verification-token.schema.js';
import { RegisterDto } from './dto/register.dto.js';
import { SocialLoginDto, SocialProvider } from './dto/social-login.dto.js';
import { EmailService } from './services/email.service.js';
import { SmsService, OtpChannel } from './services/sms.service.js';
import { JwtPayload } from './strategies/jwt.strategy.js';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { ERROR } from '../common/constants/error-messages.js';
import { OtpReason } from '../common/enums/otp-reason.enum.js';
import { RecommendationService } from '../ai/recommendation.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import {
  BCRYPT_COST_FACTOR,
  EMAIL_TOKEN_EXPIRY_HOURS,
  PHONE_OTP_EXPIRY_MINUTES,
  MAX_RESENDS_PER_HOUR,
  UNVERIFIED_REMINDER_HOURS,
  MFA_MAX_FAILED_ATTEMPTS,
  MFA_FAILED_WINDOW_MINUTES,
  MFA_LOCKOUT_MINUTES,
  MFA_ISSUER,
  PASSWORD_RESET_EXPIRY_MINUTES,
  EMAIL_CHANGE_EXPIRY_HOURS,
  PHONE_CHANGE_OTP_EXPIRY_MINUTES,
  MAX_CHANGE_REQUESTS_PER_DAY,
} from './constants/auth.constants.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;
  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(VerificationToken.name)
    private readonly verificationTokenModel: Model<VerificationTokenDocument>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly tracker: RecommendationService,
  ) {
    this.accessExpiration =
      this.configService.get<string>('jwt.accessExpiration') ?? '15m';
    this.refreshExpiration =
      this.configService.get<string>('jwt.refreshExpiration') ?? '7d';
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('google.clientId'),
    );
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; userId: string }> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    // Check for duplicates
    if (dto.email) {
      const existingEmail = await this.userModel
        .findOne({ email: dto.email })
        .exec();
      if (existingEmail) {
        throw new ConflictException(
          'Unable to complete registration. Please try a different email or phone.',
        );
      }
    }
    if (dto.phone) {
      const existingPhone = await this.userModel
        .findOne({ phone: dto.phone })
        .exec();
      if (existingPhone) {
        throw new ConflictException(
          'Unable to complete registration. Please try a different email or phone.',
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    // Create user
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

    // Send verification
    if (dto.email) {
      await this.sendEmailVerification(user._id, dto.email);
      this.trackOtp(
        UserAction.OTP_SENT,
        user._id.toString(),
        OtpChannel.EMAIL,
        OtpReason.REGISTRATION,
      );
      return {
        message:
          'Registration successful. Please check your email for verification.',
        userId: user._id.toString(),
      };
    } else {
      const channel = dto.channel || OtpChannel.SMS;
      await this.sendPhoneVerification(user._id, dto.phone!, dto.channel);
      this.trackOtp(
        UserAction.OTP_SENT,
        user._id.toString(),
        channel,
        OtpReason.REGISTRATION,
      );
      return {
        message:
          dto.channel === OtpChannel.WHATSAPP
            ? 'Registration successful. Please check your WhatsApp for the OTP code.'
            : 'Registration successful. Please check your phone for the OTP code.',
        userId: user._id.toString(),
      };
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.verificationTokenModel
      .findOne({
        token,
        type: VerificationType.EMAIL,
        used: false,
      })
      .exec();

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark token as used
    record.used = true;
    await record.save();

    // Mark email as verified
    await this.userModel
      .findByIdAndUpdate(record.userId, {
        emailVerified: true,
      })
      .exec();

    this.trackOtp(
      UserAction.OTP_VERIFIED,
      record.userId.toString(),
      OtpChannel.EMAIL,
      OtpReason.REGISTRATION,
    );

    return { message: 'Email verified successfully' };
  }

  async verifyPhone(phone: string, otp: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    const record = await this.verificationTokenModel
      .findOne({
        userId: user._id,
        type: { $in: [VerificationType.PHONE, VerificationType.WHATSAPP] },
        used: false,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!record) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    // Compare OTP hash
    const isValid = await bcrypt.compare(otp, record.token);
    if (!isValid) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Mark token as used
    record.used = true;
    await record.save();

    // Mark phone as verified
    await this.userModel
      .findByIdAndUpdate(user._id, {
        phoneVerified: true,
      })
      .exec();

    const verifyChannel =
      record.type === VerificationType.WHATSAPP
        ? OtpChannel.WHATSAPP
        : OtpChannel.SMS;
    this.trackOtp(
      UserAction.OTP_VERIFIED,
      user._id.toString(),
      verifyChannel,
      OtpReason.REGISTRATION,
    );

    return { message: 'Phone number verified successfully' };
  }

  async resendVerification(
    email?: string,
    phone?: string,
    channel?: OtpChannel,
  ): Promise<{ message: string }> {
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    let user: UserDocument | null;
    if (email) {
      user = await this.userModel.findOne({ email }).exec();
    } else {
      user = await this.userModel.findOne({ phone }).exec();
    }

    if (!user) {
      // Return generic success to prevent user enumeration
      return { message: 'If an account exists, a verification will be sent.' };
    }

    // Silently succeed if already verified (don't reveal verification status)
    if ((email && user.emailVerified) || (phone && user.phoneVerified)) {
      return { message: 'If an account exists, a verification will be sent.' };
    }

    // Rate limit: max 5 resends per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.verificationTokenModel
      .countDocuments({
        userId: user._id,
        type: email
          ? VerificationType.EMAIL
          : { $in: [VerificationType.PHONE, VerificationType.WHATSAPP] },
        createdAt: { $gte: oneHourAgo },
      })
      .exec();

    if (recentCount >= MAX_RESENDS_PER_HOUR) {
      throw new BadRequestException(
        'Maximum resend limit reached. Please try again later.',
      );
    }

    // Invalidate previous tokens
    await this.verificationTokenModel
      .updateMany(
        {
          userId: user._id,
          type: email
            ? VerificationType.EMAIL
            : { $in: [VerificationType.PHONE, VerificationType.WHATSAPP] },
          used: false,
        },
        { used: true },
      )
      .exec();

    // Send new verification
    if (email) {
      await this.sendEmailVerification(user._id, email);
      this.trackOtp(
        UserAction.OTP_RESENT,
        user._id.toString(),
        OtpChannel.EMAIL,
        OtpReason.RESEND,
      );
    } else {
      const resendChannel = channel || OtpChannel.SMS;
      await this.sendPhoneVerification(user._id, phone!, channel);
      this.trackOtp(
        UserAction.OTP_RESENT,
        user._id.toString(),
        resendChannel,
        OtpReason.RESEND,
      );
    }

    return { message: 'Verification sent successfully' };
  }

  // ─── Cron: Send reminders to unverified accounts ───

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkUnverifiedAccounts(): Promise<void> {
    const reminderThreshold = new Date(
      Date.now() - UNVERIFIED_REMINDER_HOURS * 60 * 60 * 1000,
    );

    const unverifiedUsers = await this.userModel
      .find({
        $or: [
          { email: { $exists: true }, emailVerified: false },
          { phone: { $exists: true }, phoneVerified: false },
        ],
        createdAt: { $lte: reminderThreshold },
      })
      .exec();

    for (const user of unverifiedUsers) {
      if (user.email && !user.emailVerified) {
        await this.emailService.sendReminderEmail(user.email);
      }
      if (user.phone && !user.phoneVerified) {
        await this.smsService.sendReminderSms(user.phone);
      }
    }

    this.logger.log(
      `Sent reminders to ${unverifiedUsers.length} unverified accounts`,
    );
  }

  // ─── Cron: Cleanup expired verification tokens ───

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredVerificationTokens(): Promise<void> {
    const result = await this.verificationTokenModel
      .deleteMany({
        $or: [{ expiresAt: { $lte: new Date() } }, { used: true }],
      })
      .exec();

    if (result.deletedCount > 0) {
      this.logger.log(
        `Cleaned up ${result.deletedCount} expired/used verification tokens`,
      );
    }
  }

  // ─── Cron: Cleanup expired pending email/phone changes ───

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredPendingChanges(): Promise<void> {
    const now = new Date();

    const emailResult = await this.userModel
      .updateMany(
        { 'pendingEmailChange.expiresAt': { $lte: now } },
        { $unset: { pendingEmailChange: '' } },
      )
      .exec();

    const phoneResult = await this.userModel
      .updateMany(
        { 'pendingPhoneChange.expiresAt': { $lte: now } },
        { $unset: { pendingPhoneChange: '' } },
      )
      .exec();

    const total = emailResult.modifiedCount + phoneResult.modifiedCount;
    if (total > 0) {
      this.logger.log(
        `Cleaned up ${emailResult.modifiedCount} expired email changes, ${phoneResult.modifiedCount} expired phone changes`,
      );
    }
  }

  // ─── Cron: Unlock expired MFA lockouts ───

  @Cron(CronExpression.EVERY_HOUR)
  async unlockExpiredMfaLockouts(): Promise<void> {
    const now = new Date();

    const result = await this.userModel
      .updateMany(
        {
          'mfa.enabled': true,
          'mfa.lockedUntil': { $lte: now },
        },
        {
          $set: { 'mfa.failedAttempts': 0 },
          $unset: { 'mfa.lockedUntil': '' },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`Unlocked ${result.modifiedCount} expired MFA lockouts`);
    }
  }

  async login(
    email: string | undefined,
    phone: string | undefined,
    password: string,
    userAgent?: string,
  ): Promise<{
    accessToken?: string;
    refreshToken?: string;
    user?: { id: string; email?: string; phone?: string; role: string };
    mfaRequired?: boolean;
    userId?: string;
  }> {
    if (!email && !phone) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Find user by email or phone
    let user: UserDocument | null = null;
    if (email) {
      user = await this.userModel.findOne({ email }).exec();
    } else if (phone) {
      user = await this.userModel.findOne({ phone }).exec();
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your account has been suspended. Please contact support.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if MFA is enabled — return partial response requiring MFA verification
    if (user.mfa?.enabled) {
      return {
        mfaRequired: true,
        userId: user._id.toString(),
      };
    }

    // Record login timestamp and device info
    await this.userModel
      .findByIdAndUpdate(user._id, {
        lastLoginAt: new Date(),
        lastLoginDevice: userAgent || 'unknown',
      })
      .exec();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token in Redis
    const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
    await this.storeRefreshToken(
      user._id.toString(),
      tokens.refreshJti,
      refreshTtl,
    );

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

  async socialLogin(dto: SocialLoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email?: string; phone?: string; role: string };
  }> {
    const { provider, token } = dto;

    // Verify token with provider and extract user info
    let providerEmail: string;
    let providerId: string;
    let firstName = '';
    let lastName = '';

    if (provider === SocialProvider.GOOGLE) {
      const payload = await this.verifyGoogleToken(token);
      providerEmail = payload.email;
      providerId = payload.sub;
      firstName = payload.firstName;
      lastName = payload.lastName;
    } else if (provider === SocialProvider.FACEBOOK) {
      const payload = await this.verifyFacebookToken(token);
      providerEmail = payload.email;
      providerId = payload.id;
      firstName = payload.firstName;
      lastName = payload.lastName;
    } else if (provider === SocialProvider.APPLE) {
      const payload = await this.verifyAppleToken(token);
      providerEmail = payload.email;
      providerId = payload.sub;
      // Apple only sends name on first auth; use DTO fallback
      firstName = payload.firstName || dto.firstName || '';
      lastName = payload.lastName || dto.lastName || '';
    } else {
      throw new BadRequestException('Unsupported social login provider');
    }

    // 1. Check if user exists with matching social login
    let user = await this.userModel
      .findOne({
        'socialLogins.provider': provider,
        'socialLogins.providerId': providerId,
      })
      .exec();

    if (!user) {
      // 2. Check if user exists with matching email — link social login
      user = await this.userModel.findOne({ email: providerEmail }).exec();

      if (user) {
        user.socialLogins.push({ provider, providerId });
        if (!user.emailVerified) {
          user.emailVerified = true;
        }
        await user.save();
      } else {
        // 3. Create new user account
        user = await this.userModel.create({
          email: providerEmail,
          emailVerified: true,
          socialLogins: [{ provider, providerId }],
          profile: { firstName, lastName },
        });
      }
    }

    // Record login timestamp
    await this.userModel
      .findByIdAndUpdate(user._id, {
        lastLoginAt: new Date(),
        lastLoginDevice: `social:${provider}`,
      })
      .exec();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token in Redis
    const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
    await this.storeRefreshToken(
      user._id.toString(),
      tokens.refreshJti,
      refreshTtl,
    );

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

  private async verifyGoogleToken(idToken: string): Promise<{
    email: string;
    sub: string;
    firstName: string;
    lastName: string;
  }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('google.clientId'),
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Google token missing email');
      }
      return {
        email: payload.email,
        sub: payload.sub,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private async verifyFacebookToken(accessToken: string): Promise<{
    email: string;
    id: string;
    firstName: string;
    lastName: string;
  }> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=id,email,first_name,last_name&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!response.ok) {
        throw new UnauthorizedException('Invalid Facebook token');
      }
      const data = (await response.json()) as {
        id?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
      };
      if (!data.id || !data.email) {
        throw new UnauthorizedException(
          'Facebook token missing required fields',
        );
      }
      return {
        email: data.email,
        id: data.id,
        firstName: data.first_name || '',
        lastName: data.last_name || '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Facebook token');
    }
  }

  private async verifyAppleToken(identityToken: string): Promise<{
    email: string;
    sub: string;
    firstName: string;
    lastName: string;
  }> {
    try {
      const clientId = this.configService.get<string>('apple.clientId');
      const payload = await appleSignin.verifyIdToken(identityToken, {
        audience: clientId,
        ignoreExpiration: false,
      });
      if (!payload.sub) {
        throw new UnauthorizedException('Apple token missing subject');
      }
      return {
        email: payload.email || `${payload.sub}@privaterelay.appleid.com`,
        sub: payload.sub,
        firstName: '',
        lastName: '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if refresh token exists in Redis
    const storedUserId = await this.redis.get(`rt:${payload.jti}`);
    if (!storedUserId) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Find user
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) {
      throw new UnauthorizedException(ERROR.USER_NOT_FOUND);
    }

    // Invalidate old refresh token
    await this.redis.del(`rt:${payload.jti}`);
    await this.redis.srem(`rt_set:${storedUserId}`, payload.jti);

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Store new refresh token in Redis
    const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
    await this.storeRefreshToken(
      user._id.toString(),
      tokens.refreshJti,
      refreshTtl,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(
    accessToken: string,
    userId: string,
  ): Promise<{ message: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(accessToken);
    } catch {
      // Even if token is expired, we still try to decode it for blacklisting
      try {
        payload = this.jwtService.decode(accessToken);
      } catch {
        throw new UnauthorizedException('Invalid token');
      }
    }

    if (payload && payload.jti) {
      // Blacklist the access token
      const accessTtl = this.parseExpirationToSeconds(this.accessExpiration);
      await this.redis.set(`bl:${payload.jti}`, '1', 'EX', accessTtl);
    }

    // Remove all refresh tokens for this user by scanning
    // For simplicity, we'll rely on the client discarding the refresh token
    // and the access token being blacklisted
    this.logger.log(`User ${userId} logged out`);

    return { message: 'Logged out successfully' };
  }

  async enableMfa(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    if (user.mfa?.enabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = generateTotpSecret();
    const label = user.email || user.phone || userId;
    const otpauthUrl = generateTotpURI({ label, issuer: MFA_ISSUER, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the TOTP secret
    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.totpSecret': secret,
        'mfa.enabled': true,
        'mfa.failedAttempts': 0,
        'mfa.lockedUntil': null,
      })
      .exec();

    return { secret, qrCodeUrl };
  }

  async verifyMfa(
    userId: string,
    code: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email?: string; phone?: string; role: string };
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.mfa?.enabled || !user.mfa?.totpSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Check if account is locked
    if (user.mfa.lockedUntil && user.mfa.lockedUntil > new Date()) {
      const remainingMs = user.mfa.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException(
        `Account is temporarily locked. Try again in ${remainingMin} minutes.`,
      );
    }

    // Verify the TOTP code
    let isValid = false;
    try {
      const verifyResult = verifyTotp({
        token: code,
        secret: user.mfa.totpSecret,
      });
      isValid = verifyResult.valid;
    } catch {
      // If verification throws (e.g., invalid secret format), treat as invalid
      isValid = false;
    }

    if (!isValid) {
      // Increment failed attempts
      const windowStart = new Date(
        Date.now() - MFA_FAILED_WINDOW_MINUTES * 60 * 1000,
      );
      const failedAttempts = (user.mfa.failedAttempts || 0) + 1;

      // Check if we need to reset the counter (outside the window)
      // We use a simple counter approach: if lockedUntil has passed, reset
      const updateFields: Record<string, any> = {
        'mfa.failedAttempts': failedAttempts,
      };

      if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
        updateFields['mfa.lockedUntil'] = new Date(
          Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000,
        );
        updateFields['mfa.failedAttempts'] = 0;
      }

      await this.userModel.findByIdAndUpdate(userId, updateFields).exec();

      if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
        throw new ForbiddenException(
          `Account locked for ${MFA_LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
        );
      }

      throw new UnauthorizedException('Invalid MFA code');
    }

    // Reset failed attempts on success
    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.failedAttempts': 0,
        'mfa.lockedUntil': null,
        lastLoginAt: new Date(),
        lastLoginDevice: userAgent || 'unknown',
      })
      .exec();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token in Redis
    const refreshTtl = this.parseExpirationToSeconds(this.refreshExpiration);
    await this.storeRefreshToken(
      user._id.toString(),
      tokens.refreshJti,
      refreshTtl,
    );

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

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      return { message: genericMessage };
    }

    // Invalidate any existing password reset tokens for this user
    await this.verificationTokenModel
      .updateMany(
        {
          userId: user._id,
          type: VerificationType.PASSWORD_RESET,
          used: false,
        },
        { used: true },
      )
      .exec();

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
    );

    await this.verificationTokenModel.create({
      userId: user._id,
      type: VerificationType.PASSWORD_RESET,
      token,
      expiresAt,
    });

    await this.emailService.sendPasswordResetEmail(email, token);

    this.trackOtp(
      UserAction.OTP_SENT,
      user._id.toString(),
      OtpChannel.EMAIL,
      OtpReason.PASSWORD_RESET,
    );

    return { message: genericMessage };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const record = await this.verificationTokenModel
      .findOne({
        token,
        type: VerificationType.PASSWORD_RESET,
        used: false,
      })
      .exec();

    if (!record) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Password reset token has expired');
    }

    // Mark token as used
    record.used = true;
    await record.save();

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

    // Update user password
    await this.userModel
      .findByIdAndUpdate(record.userId, {
        passwordHash,
      })
      .exec();

    // Invalidate all sessions by removing all refresh tokens from Redis
    await this.invalidateAllSessions(record.userId.toString());

    this.trackOtp(
      UserAction.OTP_VERIFIED,
      record.userId.toString(),
      OtpChannel.EMAIL,
      OtpReason.PASSWORD_RESET,
    );

    return { message: 'Password has been reset successfully' };
  }

  async invalidateAllSessions(userId: string): Promise<void> {
    const userSetKey = `rt_set:${userId}`;
    const jtis = await this.redis.smembers(userSetKey);

    if (jtis.length > 0) {
      const keys = jtis.map((jti) => `rt:${jti}`);
      await this.redis.del(...keys);
    }
    await this.redis.del(userSetKey);
  }

  async requestEmailChange(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    // Check if new email is already in use
    const existing = await this.userModel.findOne({ email: newEmail }).exec();
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    // Enforce rate limit: max 3 change requests per 24 hours
    this.enforceChangeRateLimit(user);

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + EMAIL_CHANGE_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    // Store pending change on user document
    await this.userModel
      .findByIdAndUpdate(userId, {
        pendingEmailChange: { newEmail, verificationToken: token, expiresAt },
        $inc: { 'verificationChangeCount.count': 1 },
      })
      .exec();

    // Send verification email to new address
    await this.emailService.sendEmailChangeVerification(newEmail, token);

    this.trackOtp(
      UserAction.OTP_SENT,
      userId,
      OtpChannel.EMAIL,
      OtpReason.EMAIL_CHANGE,
    );

    return { message: 'Verification link sent to new email address' };
  }

  async verifyEmailChange(token: string): Promise<{ message: string }> {
    const user = await this.userModel
      .findOne({
        'pendingEmailChange.verificationToken': token,
      })
      .exec();

    if (!user || !user.pendingEmailChange) {
      throw new BadRequestException('Invalid or expired email change token');
    }

    if (user.pendingEmailChange.expiresAt < new Date()) {
      // Discard expired request
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $unset: { pendingEmailChange: 1 },
        })
        .exec();
      throw new BadRequestException('Email change token has expired');
    }

    // Check if new email is still available
    const existing = await this.userModel
      .findOne({
        email: user.pendingEmailChange.newEmail,
        _id: { $ne: user._id },
      })
      .exec();
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmailChange.newEmail;

    // Update email, mark verified, clear pending change
    await this.userModel
      .findByIdAndUpdate(user._id, {
        email: newEmail,
        emailVerified: true,
        $unset: { pendingEmailChange: 1 },
      })
      .exec();

    // Invalidate all sessions
    await this.invalidateAllSessions(user._id.toString());

    // Notify old email
    if (oldEmail) {
      await this.emailService.sendEmailChangeNotification(oldEmail);
    }

    this.trackOtp(
      UserAction.OTP_VERIFIED,
      user._id.toString(),
      OtpChannel.EMAIL,
      OtpReason.EMAIL_CHANGE,
      { oldEmail, newEmail },
    );

    return { message: 'Email updated successfully' };
  }

  async requestPhoneChange(
    userId: string,
    newPhone: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.USER_NOT_FOUND);
    }

    // Check if new phone is already in use
    const existing = await this.userModel.findOne({ phone: newPhone }).exec();
    if (existing) {
      throw new ConflictException('Phone number is already in use');
    }

    // Enforce rate limit: max 3 change requests per 24 hours
    this.enforceChangeRateLimit(user);

    // Generate OTP
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_COST_FACTOR);
    const expiresAt = new Date(
      Date.now() + PHONE_CHANGE_OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // Store pending change on user document
    await this.userModel
      .findByIdAndUpdate(userId, {
        pendingPhoneChange: { newPhone, otpHash, expiresAt, attempts: 0 },
        $inc: { 'verificationChangeCount.count': 1 },
      })
      .exec();

    // Send OTP to new phone
    await this.smsService.sendOtp(newPhone, otp);

    this.trackOtp(
      UserAction.OTP_SENT,
      userId,
      OtpChannel.SMS,
      OtpReason.PHONE_CHANGE,
    );

    return { message: 'OTP sent to new phone number' };
  }

  async verifyPhoneChange(
    userId: string,
    otp: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.pendingPhoneChange) {
      throw new BadRequestException('No pending phone change request');
    }

    if (user.pendingPhoneChange.expiresAt < new Date()) {
      // Discard expired request
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $unset: { pendingPhoneChange: 1 },
        })
        .exec();
      throw new BadRequestException('Phone change OTP has expired');
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, user.pendingPhoneChange.otpHash);
    if (!isValid) {
      // Increment attempts
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $inc: { 'pendingPhoneChange.attempts': 1 },
        })
        .exec();
      throw new BadRequestException('Invalid OTP code');
    }

    // Check if new phone is still available
    const existing = await this.userModel
      .findOne({
        phone: user.pendingPhoneChange.newPhone,
        _id: { $ne: user._id },
      })
      .exec();
    if (existing) {
      throw new ConflictException('Phone number is already in use');
    }

    const newPhone = user.pendingPhoneChange.newPhone;

    // Update phone, mark verified, clear pending change
    await this.userModel
      .findByIdAndUpdate(user._id, {
        phone: newPhone,
        phoneVerified: true,
        $unset: { pendingPhoneChange: 1 },
      })
      .exec();

    // Invalidate all sessions
    await this.invalidateAllSessions(user._id.toString());

    this.trackOtp(
      UserAction.OTP_VERIFIED,
      userId,
      OtpChannel.SMS,
      OtpReason.PHONE_CHANGE,
      { newPhone },
    );

    return { message: 'Phone number updated successfully' };
  }

  private enforceChangeRateLimit(user: UserDocument): void {
    const changeCount = user.verificationChangeCount;
    if (changeCount && changeCount.count >= MAX_CHANGE_REQUESTS_PER_DAY) {
      // Check if the reset window has passed
      if (changeCount.resetAt && changeCount.resetAt > new Date()) {
        throw new BadRequestException(
          'Maximum change requests reached. Please try again later.',
        );
      }
    }
  }

  isUserVerified(user: UserDocument): boolean {
    if (user.email && !user.emailVerified) return false;
    if (user.phone && !user.phoneVerified) return false;
    return true;
  }

  private async sendEmailVerification(
    userId: Types.ObjectId,
    email: string,
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.verificationTokenModel.create({
      userId,
      type: VerificationType.EMAIL,
      token,
      expiresAt,
    });

    await this.emailService.sendVerificationEmail(email, token);
  }

  private async sendPhoneVerification(
    userId: Types.ObjectId,
    phone: string,
    channel: OtpChannel = OtpChannel.SMS,
  ): Promise<void> {
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_COST_FACTOR);
    const expiresAt = new Date(
      Date.now() + PHONE_OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    const tokenType =
      channel === OtpChannel.WHATSAPP
        ? VerificationType.WHATSAPP
        : VerificationType.PHONE;

    await this.verificationTokenModel.create({
      userId,
      type: tokenType,
      token: otpHash,
      expiresAt,
    });

    await this.smsService.sendOtp(phone, otp, channel);
  }

  private generateOtp(): string {
    const num = crypto.randomInt(0, 1000000);
    return num.toString().padStart(6, '0');
  }

  private async generateTokens(user: UserDocument): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshJti: string;
  }> {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessPayload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      type: 'access',
      jti: accessJti,
    };

    const refreshPayload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      type: 'refresh',
      jti: refreshJti,
    };

    const accessToken = this.jwtService.sign(
      { ...accessPayload } as Record<string, unknown>,
      { expiresIn: this.accessExpiration as any },
    );

    const refreshToken = this.jwtService.sign(
      { ...refreshPayload } as Record<string, unknown>,
      { expiresIn: this.refreshExpiration as any },
    );

    return { accessToken, refreshToken, refreshJti };
  }

  parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  /** Fire-and-forget OTP event tracking */
  private async storeRefreshToken(
    userId: string,
    jti: string,
    ttl: number,
  ): Promise<void> {
    const key = `rt:${jti}`;
    const userSetKey = `rt_set:${userId}`;
    await this.redis.set(key, userId, 'EX', ttl);
    await this.redis.sadd(userSetKey, jti);
    // Set expiry on the set to auto-cleanup (slightly longer than token TTL)
    await this.redis.expire(userSetKey, ttl + 3600);
  }

  private trackOtp(
    action: UserAction,
    userId: string | undefined,
    channel: string,
    reason: OtpReason,
    extra: Record<string, any> = {},
  ): void {
    this.tracker
      .trackActivity(userId, action, {
        metadata: { channel, reason, ...extra },
      })
      .catch((err) =>
        this.logger.warn(`OTP tracking failed: ${(err as Error).message}`),
      );
  }
}
