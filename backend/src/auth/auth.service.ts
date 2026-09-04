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
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { CronLock } from '../common/decorators/cron-lock.decorator.js';
import { OtpReason } from '../common/enums/otp-reason.enum.js';
import { RecommendationService } from '../ai/recommendation.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import {
  BCRYPT_COST_FACTOR,
  EMAIL_TOKEN_EXPIRY_HOURS,
  PHONE_OTP_EXPIRY_MINUTES,
  EMAIL_OTP_EXPIRY_MINUTES,
  MAX_RESENDS_PER_HOUR,
  MAX_OTP_VERIFY_ATTEMPTS,
  UNVERIFIED_REMINDER_HOURS,
  MFA_MAX_FAILED_ATTEMPTS,
  MFA_FAILED_WINDOW_MINUTES,
  MFA_LOCKOUT_MINUTES,
  MFA_ISSUER,
  MFA_TICKET_EXPIRATION,
  MFA_TICKET_TTL_SECONDS,
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    // Check for duplicates
    if (dto.email) {
      const existingEmail = await this.userModel
        .findOne({ email: dto.email })
        .exec();
      if (existingEmail) {
        throw new ConflictException(PUBLIC_ERROR.CONFLICT);
      }
    }
    if (dto.phone) {
      const existingPhone = await this.userModel
        .findOne({ phone: dto.phone })
        .exec();
      if (existingPhone) {
        throw new ConflictException(PUBLIC_ERROR.CONFLICT);
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
      wantsIdVerification: dto.wantsIdVerification ?? false,
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
        token: this.hashLinkToken(token),
        type: VerificationType.EMAIL,
        used: false,
      })
      .exec();

    if (!record) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Mark token as used
    record.used = true;
    await record.save();

    // Mark email as verified
    const verifiedUser = await this.userModel
      .findByIdAndUpdate(
        record.userId,
        {
          emailVerified: true,
        },
        { new: true },
      )
      .exec();

    // Send a welcome email now that the address is confirmed
    if (verifiedUser?.email) {
      await this.emailService.sendWelcomeEmail(verifiedUser.email);
    }

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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Guard against brute force: invalidate the OTP once too many wrong
    // attempts have been made against it.
    if (record.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      record.used = true;
      await record.save();
      this.trackOtp(
        UserAction.OTP_FAILED,
        user._id.toString(),
        record.type === VerificationType.WHATSAPP
          ? OtpChannel.WHATSAPP
          : OtpChannel.SMS,
        OtpReason.REGISTRATION,
      );
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Compare OTP hash
    const isValid = await bcrypt.compare(otp, record.token);
    if (!isValid) {
      record.attempts += 1;
      await record.save();
      this.trackOtp(
        UserAction.OTP_FAILED,
        user._id.toString(),
        record.type === VerificationType.WHATSAPP
          ? OtpChannel.WHATSAPP
          : OtpChannel.SMS,
        OtpReason.REGISTRATION,
      );
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
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
  @CronLock()
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
  @CronLock()
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
  @CronLock()
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
  @CronLock()
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
    mfaToken?: string;
  }> {
    if (!email && !phone) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Find user by email or phone
    let user: UserDocument | null = null;
    if (email) {
      user = await this.userModel.findOne({ email }).exec();
    } else if (phone) {
      user = await this.userModel.findOne({ phone }).exec();
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    if (user.status === UserStatus.SUSPENDED) {
      // A suspension with an elapsed `suspendedUntil` lifts itself: reactivate
      // on the next login attempt rather than requiring a manual unsuspend or a
      // separate cron. A suspension with no end date (e.g. a manual admin ban)
      // stays until an admin clears it.
      if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
        user.status = UserStatus.ACTIVE;
        user.suspendedUntil = undefined;
        user.suspensionReason = undefined;
        await user.save();
      } else {
        throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Password is correct but the account owes a second factor. Hand back a
    // ticket that records that fact; `verifyMfa` will not issue a session
    // without one. Returning the bare user id here (as this used to) proved
    // nothing, because a user id is not a secret.
    if (user.mfa?.enabled) {
      return {
        mfaRequired: true,
        mfaToken: await this.issueMfaTicket(user),
      };
    }

    // Record login timestamp and device info
    const loginAt = new Date();
    const device = userAgent || 'unknown';
    await this.maybeAlertNewDevice(user, device, loginAt);
    await this.userModel
      .findByIdAndUpdate(user._id, {
        lastLoginAt: loginAt,
        lastLoginDevice: device,
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

  /**
   * Emails the user when a sign-in comes from a device that differs from the
   * last one on record. Skipped for the very first login (no prior device).
   */
  private async maybeAlertNewDevice(
    user: UserDocument,
    device: string,
    when: Date,
  ): Promise<void> {
    if (!user.email) return;
    if (!user.lastLoginDevice) return; // first-ever login, nothing to compare
    if (user.lastLoginDevice === device) return;

    await this.emailService.sendNewDeviceLoginEmail(user.email, device, when);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
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
        throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
      }
      return {
        email: payload.email,
        sub: payload.sub,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
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
        throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
      }
      const data = (await response.json()) as {
        id?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
      };
      if (!data.id || !data.email) {
        throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
      }
      return {
        email: data.email,
        id: data.id,
        firstName: data.first_name || '',
        lastName: data.last_name || '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
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
        throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
      }
      return {
        email: payload.email || `${payload.sub}@privaterelay.appleid.com`,
        sub: payload.sub,
        firstName: '',
        lastName: '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
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
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Check if refresh token exists in Redis
    const storedUserId = await this.redis.get(`rt:${payload.jti}`);
    if (!storedUserId) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Find user
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
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
        throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
      }
    }

    if (payload && payload.jti) {
      // Blacklist the access token
      const accessTtl = this.parseExpirationToSeconds(this.accessExpiration);
      await this.redis.set(`bl:${payload.jti}`, '1', 'EX', accessTtl);
    }

    // Revoke the refresh tokens too. Blacklisting only the access token left the
    // 7-day refresh token working, so a stolen one kept minting access tokens
    // long after the victim thought they had signed out — the previous comment
    // here relied on "the client discarding the refresh token", which an attacker
    // holding it will not do.
    await this.invalidateAllSessions(userId);

    this.logger.log(`User ${userId} logged out`);

    return { message: 'Logged out successfully' };
  }

  async enableMfa(
    userId: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (user.mfa?.enabled) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const secret = generateTotpSecret();
    const label = user.email || user.phone || userId;
    const otpauthUrl = generateTotpURI({ label, issuer: MFA_ISSUER, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Held as *pending* and deliberately not switched on. Enabling in this same
    // call locked out every user who opened the setup screen and never finished
    // pairing: their next login demanded a code from an authenticator that had
    // no secret in it. `confirmMfa` promotes this once a code proves the app
    // works.
    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.pendingTotpSecret': secret,
        'mfa.failedAttempts': 0,
        'mfa.lockedUntil': null,
      })
      .exec();

    return { secret, qrCodeUrl };
  }

  /**
   * Completes setup by checking a code from the newly paired authenticator.
   *
   * This is the only place `mfa.enabled` becomes true, so the requirement can
   * never be switched on for a secret the user cannot generate codes from.
   */
  async confirmMfa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (user.mfa?.enabled) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const pending = user.mfa?.pendingTotpSecret;
    if (!pending) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    if (!this.isTotpValid(code, pending)) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.totpSecret': pending,
        'mfa.enabled': true,
        'mfa.failedAttempts': 0,
        'mfa.lockedUntil': null,
        $unset: { 'mfa.pendingTotpSecret': '' },
      })
      .exec();

    // Notify the user that 2FA was enabled
    if (user.email) {
      await this.emailService.sendMfaEnabledEmail(user.email);
    }

    return { message: 'Two-factor authentication enabled' };
  }

  /**
   * @param password the account password, re-entered. Without it, a stolen
   * access token was enough to remove the second factor.
   */
  async disableMfa(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (!user.mfa?.enabled) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    await this.assertPasswordMatches(user, password);

    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.enabled': false,
        'mfa.failedAttempts': 0,
        $unset: {
          'mfa.totpSecret': '',
          'mfa.pendingTotpSecret': '',
          'mfa.lockedUntil': '',
        },
      })
      .exec();

    // Notify the user that 2FA was disabled
    if (user.email) {
      await this.emailService.sendMfaDisabledEmail(user.email);
    }

    return { message: 'Two-factor authentication disabled' };
  }

  /**
   * Re-checks the account password before a change that could hand the account
   * over.
   *
   * A bearer token proves only that someone held it at some point — it says
   * nothing about whether that someone is the owner. For operations whose whole
   * effect is to move control of the account (the recovery email, the recovery
   * phone, the second factor), that is not enough on its own.
   *
   * Accounts created through a social provider have no password to re-enter;
   * comparing against an absent hash would fail forever and strand them, so they
   * are refused explicitly.
   */
  private async assertPasswordMatches(
    user: UserDocument,
    password: string,
  ): Promise<void> {
    if (!user.passwordHash) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }
  }

  /**
   * Changes the password of a signed-in user who knows the current one.
   *
   * Every session is dropped afterwards, matching the reset flow: if the reason
   * for changing was a suspected compromise, leaving the other sessions alive
   * would defeat the point.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    await this.assertPasswordMatches(user, currentPassword);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);
    await this.userModel.findByIdAndUpdate(userId, { passwordHash }).exec();

    await this.invalidateAllSessions(userId);

    if (user.email) {
      await this.emailService.sendPasswordChangedEmail(user.email);
    }

    return { message: 'Password changed successfully' };
  }

  /**
   * One-way transform for the long random tokens that arrive in email links.
   *
   * They were stored verbatim, so any read of the database — a backup, an
   * analytics replica, a log line, an over-broad query — handed over a working
   * password reset for every account with one outstanding. Storing the digest
   * means a copy of the collection is inert: the link that was emailed cannot be
   * recovered from it.
   *
   * SHA-256 rather than bcrypt, unlike the OTPs: these are looked up *by* their
   * value, which a per-record salt would make impossible, and at 256 bits of
   * entropy there is nothing to brute-force, which is the only thing bcrypt's
   * cost factor buys. Short OTPs stay on bcrypt for exactly that reason.
   */
  private hashLinkToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Checks a TOTP code without leaking why it failed.
   *
   * `verifySync` throws on a malformed secret rather than returning false, which
   * would surface as a 500 and distinguish "bad secret" from "bad code".
   */
  private isTotpValid(code: string, secret: string): boolean {
    try {
      return verifyTotp({ token: code, secret }).valid;
    } catch {
      return false;
    }
  }

  /**
   * Mints the proof that a password check succeeded.
   *
   * Signed with the same key as the session tokens but carrying `type: 'mfa'`,
   * which `JwtStrategy` refuses — so the ticket opens nothing on its own. The
   * jti is also recorded in Redis and removed when spent, making the ticket
   * single-use: one password check buys one session, not a five-minute window in
   * which to mint many.
   */
  private async issueMfaTicket(user: UserDocument): Promise<string> {
    const jti = crypto.randomUUID();
    const ticket = this.jwtService.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        type: 'mfa',
        jti,
      } as Record<string, unknown>,
      { expiresIn: MFA_TICKET_EXPIRATION as any },
    );

    await this.redis.set(
      `mfa:${jti}`,
      user._id.toString(),
      'EX',
      MFA_TICKET_TTL_SECONDS,
    );

    return ticket;
  }

  /**
   * Validates a ticket and returns the user id it was issued for.
   *
   * Every rejection is the same 401: a caller probing tickets learns nothing
   * about which ones exist.
   */
  private async resolveMfaTicket(mfaToken: string): Promise<{
    userId: string;
    jti: string;
  }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(mfaToken);
    } catch {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    if (payload.type !== 'mfa' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Signature and expiry are not enough on their own — this is what makes a
    // spent ticket stop working before its five minutes are up.
    const storedUserId = await this.redis.get(`mfa:${payload.jti}`);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    return { userId: payload.sub, jti: payload.jti };
  }

  /**
   * Exchanges an MFA ticket plus a TOTP code for a session.
   *
   * @param mfaToken the ticket from `login`. It carries the user identity, so
   * the caller no longer names the account it wants a session for.
   */
  async verifyMfa(
    mfaToken: string,
    code: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email?: string; phone?: string; role: string };
  }> {
    const { userId, jti } = await this.resolveMfaTicket(mfaToken);

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    if (!user.mfa?.enabled || !user.mfa?.totpSecret) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    // Check if account is locked
    if (user.mfa.lockedUntil && user.mfa.lockedUntil > new Date()) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }

    const isValid = this.isTotpValid(code, user.mfa.totpSecret);

    if (!isValid) {
      // MFA_FAILED_WINDOW_MINUTES used to be computed here and then ignored, so
      // the counter only ever reset on a success or the hourly cron: five
      // mistyped codes months apart added up to a lockout. Failures older than
      // the window now start a fresh count.
      const windowStart = Date.now() - MFA_FAILED_WINDOW_MINUTES * 60 * 1000;
      const lastFailedAt = user.mfa.lastFailedAt?.getTime() ?? 0;
      const withinWindow = lastFailedAt >= windowStart;
      const failedAttempts = withinWindow
        ? (user.mfa.failedAttempts || 0) + 1
        : 1;

      const updateFields: Record<string, any> = {
        'mfa.failedAttempts': failedAttempts,
        'mfa.lastFailedAt': new Date(),
      };

      if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
        updateFields['mfa.lockedUntil'] = new Date(
          Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000,
        );
        updateFields['mfa.failedAttempts'] = 0;
      }

      await this.userModel.findByIdAndUpdate(userId, updateFields).exec();

      if (failedAttempts >= MFA_MAX_FAILED_ATTEMPTS) {
        // Notify the user their account was locked after repeated failures
        if (user.email) {
          await this.emailService.sendAccountLockedEmail(
            user.email,
            MFA_LOCKOUT_MINUTES,
          );
        }
        throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
      }

      throw new UnauthorizedException(PUBLIC_ERROR.AUTH_FAILED);
    }

    // Spend the ticket. Only on success, so a mistyped code costs a retry rather
    // than sending the user back to the password screen — the per-account
    // lockout above is what bounds guessing, not the ticket.
    await this.redis.del(`mfa:${jti}`);

    // Reset failed attempts on success
    const loginAt = new Date();
    const device = userAgent || 'unknown';
    await this.maybeAlertNewDevice(user, device, loginAt);
    await this.userModel
      .findByIdAndUpdate(userId, {
        'mfa.failedAttempts': 0,
        'mfa.lockedUntil': null,
        lastLoginAt: loginAt,
        lastLoginDevice: device,
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
      // Only the digest is persisted; `token` itself exists solely in the email.
      token: this.hashLinkToken(token),
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
        token: this.hashLinkToken(token),
        type: VerificationType.PASSWORD_RESET,
        used: false,
      })
      .exec();

    if (!record) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Mark token as used
    record.used = true;
    await record.save();

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

    // Update user password
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        record.userId,
        {
          passwordHash,
        },
        { new: true },
      )
      .exec();

    // Invalidate all sessions by removing all refresh tokens from Redis
    await this.invalidateAllSessions(record.userId.toString());

    // Notify the user their password was changed
    if (updatedUser?.email) {
      await this.emailService.sendPasswordChangedEmail(updatedUser.email);
    }

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
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Before anything else: the new address becomes the account's recovery
    // channel, so this request is an account handover if it is not the owner
    // making it.
    await this.assertPasswordMatches(user, password);

    // Check if new email is already in use
    const existing = await this.userModel.findOne({ email: newEmail }).exec();
    if (existing) {
      throw new ConflictException(PUBLIC_ERROR.CONFLICT);
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
        pendingEmailChange: {
          newEmail,
          verificationToken: this.hashLinkToken(token),
          expiresAt,
        },
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
        'pendingEmailChange.verificationToken': this.hashLinkToken(token),
      })
      .exec();

    if (!user || !user.pendingEmailChange) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    if (user.pendingEmailChange.expiresAt < new Date()) {
      // Discard expired request
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $unset: { pendingEmailChange: 1 },
        })
        .exec();
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Check if new email is still available
    const existing = await this.userModel
      .findOne({
        email: user.pendingEmailChange.newEmail,
        _id: { $ne: user._id },
      })
      .exec();
    if (existing) {
      throw new ConflictException(PUBLIC_ERROR.CONFLICT);
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
    password?: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Check if new phone is already in use by another user
    const existing = await this.userModel.findOne({ phone: newPhone }).exec();
    if (existing && existing._id.toString() !== userId) {
      throw new ConflictException(PUBLIC_ERROR.CONFLICT);
    }

    // If the phone belongs to this same user and is already verified, nothing to do
    if (existing && existing._id.toString() === userId && user.phoneVerified) {
      return { message: 'Phone number is already verified.' };
    }

    // If the phone belongs to this same user but is unverified, send a
    // standard phone verification OTP (not a "change" OTP) so verifyPhone()
    // can be used to confirm it.
    if (existing && existing._id.toString() === userId && !user.phoneVerified) {
      await this.sendPhoneVerification(user._id, newPhone);
      this.trackOtp(
        UserAction.OTP_SENT,
        userId,
        OtpChannel.SMS,
        OtpReason.REGISTRATION,
      );
      return { message: 'OTP sent to your phone number' };
    }

    // Everything above either rejects the request or re-sends a code to a number
    // already on this account — no change of control, so no password needed. That
    // matters because listing creation drives this endpoint to verify the phone a
    // user already has; demanding a password there would put a password prompt in
    // the middle of posting an ad.
    //
    // Past this point the recovery number genuinely moves, which is an account
    // handover if the caller is not the owner. A bearer token alone does not show
    // that.
    await this.assertPasswordMatches(user, password ?? '');

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
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    if (user.pendingPhoneChange.expiresAt < new Date()) {
      // Discard expired request
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $unset: { pendingPhoneChange: 1 },
        })
        .exec();
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Guard against brute force: discard the pending change once too many
    // wrong attempts have been made against it.
    if (user.pendingPhoneChange.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await this.userModel
        .findByIdAndUpdate(user._id, {
          $unset: { pendingPhoneChange: 1 },
        })
        .exec();
      this.trackOtp(
        UserAction.OTP_FAILED,
        userId,
        OtpChannel.SMS,
        OtpReason.PHONE_CHANGE,
      );
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
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
      this.trackOtp(
        UserAction.OTP_FAILED,
        userId,
        OtpChannel.SMS,
        OtpReason.PHONE_CHANGE,
      );
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    // Check if new phone is still available
    const existing = await this.userModel
      .findOne({
        phone: user.pendingPhoneChange.newPhone,
        _id: { $ne: user._id },
      })
      .exec();
    if (existing) {
      throw new ConflictException(PUBLIC_ERROR.CONFLICT);
    }

    const newPhone = user.pendingPhoneChange.newPhone;

    const notifyEmail = user.email;

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

    // Notify the account's email that the phone number changed
    if (notifyEmail) {
      await this.emailService.sendPhoneChangeNotification(notifyEmail);
    }

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
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
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
      token: this.hashLinkToken(token),
      expiresAt,
    });

    await this.emailService.sendVerificationEmail(email, token);
  }

  // ─── Email OTP (used when user is already logged in) ───────────────────────

  /**
   * Sends an email OTP. If targetEmail is provided, the OTP is sent to that
   * address and stored on the token. The user's email is NOT changed yet —
   * it is only updated after successful OTP verification.
   */
  async sendEmailOtp(
    userId: string,
    targetEmail?: string,
    password?: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const sendTo = targetEmail ?? user.email;
    if (!sendTo) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // A targetEmail makes this an email *change*, completed by verifyEmailOtp —
    // the second route to moving the recovery address, and the one the web UI
    // actually uses. It asked for no password, so a stolen access token could
    // send a code to an attacker's inbox and hand them the account; closing only
    // `change-email` would have left this door open next to it.
    //
    // Verifying the address already on the account changes nothing and stays
    // password-free.
    if (targetEmail && targetEmail !== user.email) {
      await this.assertPasswordMatches(user, password ?? '');

      const existing = await this.userModel
        .findOne({ email: targetEmail, _id: { $ne: user._id } })
        .exec();
      if (existing) {
        throw new ConflictException(PUBLIC_ERROR.CONFLICT);
      }
    }

    // If sending to current email and already verified, nothing to do
    if (!targetEmail && user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.verificationTokenModel
      .countDocuments({
        userId: user._id,
        type: VerificationType.EMAIL_OTP,
        createdAt: { $gte: oneHourAgo },
      })
      .exec();
    if (recentCount >= MAX_RESENDS_PER_HOUR) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    // Invalidate previous OTPs
    await this.verificationTokenModel
      .updateMany(
        { userId: user._id, type: VerificationType.EMAIL_OTP, used: false },
        { used: true },
      )
      .exec();

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_COST_FACTOR);
    const expiresAt = new Date(
      Date.now() + EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await this.verificationTokenModel.create({
      userId: user._id,
      type: VerificationType.EMAIL_OTP,
      token: otpHash,
      expiresAt,
      ...(targetEmail ? { targetEmail } : {}),
    });

    await this.emailService.sendOtpEmail(sendTo, otp);

    this.trackOtp(
      UserAction.OTP_SENT,
      userId,
      OtpChannel.EMAIL,
      targetEmail ? OtpReason.EMAIL_CHANGE : OtpReason.REGISTRATION,
    );

    return { message: 'Verification code sent to your email.' };
  }

  async verifyEmailOtp(
    userId: string,
    otp: string,
  ): Promise<{ message: string }> {
    const record = await this.verificationTokenModel
      .findOne({
        userId: new Types.ObjectId(userId),
        type: VerificationType.EMAIL_OTP,
        used: false,
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    const otpReason = record.targetEmail
      ? OtpReason.EMAIL_CHANGE
      : OtpReason.REGISTRATION;

    // Guard against brute force: invalidate the OTP once too many wrong
    // attempts have been made against it.
    if (record.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      record.used = true;
      await record.save();
      this.trackOtp(UserAction.OTP_FAILED, userId, OtpChannel.EMAIL, otpReason);
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    const isValid = await bcrypt.compare(otp, record.token);
    if (!isValid) {
      record.attempts += 1;
      await record.save();
      this.trackOtp(UserAction.OTP_FAILED, userId, OtpChannel.EMAIL, otpReason);
      throw new BadRequestException(PUBLIC_ERROR.VERIFICATION_FAILED);
    }

    record.used = true;
    await record.save();

    // If a targetEmail was stored, update the user's email to that address now
    const update: Record<string, any> = { emailVerified: true };
    if (record.targetEmail) {
      const existing = await this.userModel
        .findOne({
          email: record.targetEmail,
          _id: { $ne: new Types.ObjectId(userId) },
        })
        .exec();
      if (existing) {
        throw new ConflictException(PUBLIC_ERROR.CONFLICT);
      }
      update.email = record.targetEmail;
    }

    const otpVerifiedUser = await this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .exec();

    // Send a welcome email for first-time verification (not email changes)
    if (!record.targetEmail && otpVerifiedUser?.email) {
      await this.emailService.sendWelcomeEmail(otpVerifiedUser.email);
    }

    this.trackOtp(UserAction.OTP_VERIFIED, userId, OtpChannel.EMAIL, otpReason);

    return { message: 'Email verified successfully.' };
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
