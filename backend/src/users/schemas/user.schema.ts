import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SocialProvider } from '../../common/enums/social-provider.enum.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { UserStatus } from '../../common/enums/user-status.enum.js';
import { Permission } from '../../common/enums/permission.enum.js';

export { UserRole } from '../../common/enums/user-role.enum.js';
export { UserStatus } from '../../common/enums/user-status.enum.js';
export { Permission } from '../../common/enums/permission.enum.js';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserLocation {
  @Prop({ type: String, default: 'Point' })
  type!: string;

  @Prop({ type: [Number], default: [0, 0] })
  coordinates!: number[];
}

@Schema({ _id: false })
export class UserProfile {
  @Prop({ type: String, default: '' })
  firstName!: string;

  @Prop({ type: String, default: '' })
  lastName!: string;

  @Prop({ type: String, default: '' })
  avatar!: string;

  @Prop({ type: UserLocation })
  location?: UserLocation;

  @Prop({ type: String, default: '' })
  city!: string;

  @Prop({ type: String, default: '' })
  postalCode!: string;
}

@Schema({ _id: false })
export class PendingEmailChange {
  @Prop({ type: String, required: true })
  newEmail!: string;

  @Prop({ type: String, required: true })
  verificationToken!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

@Schema({ _id: false })
export class PendingPhoneChange {
  @Prop({ type: String, required: true })
  newPhone!: string;

  @Prop({ type: String, required: true })
  otpHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Number, default: 0 })
  attempts!: number;
}

@Schema({ _id: false })
export class VerificationChangeCount {
  @Prop({ type: Number, default: 0 })
  count!: number;

  @Prop({ type: Date })
  resetAt?: Date;
}

@Schema({ _id: false })
export class SocialLogin {
  @Prop({
    type: String,
    enum: Object.values(SocialProvider),
    required: true,
  })
  provider!: string;

  @Prop({ type: String, required: true })
  providerId!: string;
}

@Schema({ _id: false })
export class MfaSettings {
  @Prop({ type: Boolean, default: false })
  enabled!: boolean;

  @Prop({ type: String })
  totpSecret?: string;

  @Prop({ type: Number, default: 0 })
  failedAttempts!: number;

  @Prop({ type: Date })
  lockedUntil?: Date;
}

@Schema({ _id: false })
export class NotificationPreferences {
  @Prop({ type: Boolean, default: true })
  messages!: boolean;

  @Prop({ type: Boolean, default: true })
  offers!: boolean;

  @Prop({ type: Boolean, default: true })
  productUpdates!: boolean;

  @Prop({ type: Boolean, default: true })
  promotions!: boolean;

  @Prop({ type: Boolean, default: true })
  packageAlerts!: boolean;
}

@Schema({ _id: false })
export class DeviceToken {
  @Prop({ type: String, required: true })
  platform!: string;

  @Prop({ type: String, required: true })
  token!: string;
}

@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: {
    transform: (_doc: any, ret: any) => {
      delete ret.passwordHash;
      delete ret.__v;
      delete ret.deletedAt;
      if (ret.mfa) delete ret.mfa.totpSecret;
      if (ret.pendingEmailChange)
        delete ret.pendingEmailChange.verificationToken;
      if (ret.pendingPhoneChange) delete ret.pendingPhoneChange.otpHash;
      return ret;
    },
  },
})
export class User {
  _id!: Types.ObjectId;

  @Prop({ type: String })
  email?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  passwordHash?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Prop({ type: [String], enum: Object.values(Permission), default: [] })
  permissions!: string[];

  @Prop({ type: UserProfile, default: () => ({}) })
  profile!: UserProfile;

  @Prop({ type: Boolean, default: false })
  emailVerified!: boolean;

  @Prop({ type: Boolean, default: false })
  phoneVerified!: boolean;

  @Prop({ type: Boolean, default: false })
  idVerified!: boolean;

  /**
   * The user asked to verify their ID while registering.
   *
   * Intent, not status — `idVerified` is the status. It is recorded because ID
   * upload needs an authenticated session and registration does not create one:
   * the account still has to confirm its email or phone and log in first. This
   * carries the request across that gap so the client can take them straight to
   * the ID step on their first sign-in instead of losing the moment they said yes.
   */
  @Prop({ type: Boolean, default: false })
  wantsIdVerification!: boolean;

  @Prop({ type: PendingEmailChange })
  pendingEmailChange?: PendingEmailChange;

  @Prop({ type: PendingPhoneChange })
  pendingPhoneChange?: PendingPhoneChange;

  @Prop({ type: VerificationChangeCount, default: () => ({}) })
  verificationChangeCount!: VerificationChangeCount;

  @Prop({ type: [SocialLogin], default: [] })
  socialLogins!: SocialLogin[];

  @Prop({ type: MfaSettings, default: () => ({}) })
  mfa!: MfaSettings;

  @Prop({ type: NotificationPreferences, default: () => ({}) })
  notificationPreferences!: NotificationPreferences;

  @Prop({ type: [DeviceToken], default: [] })
  deviceTokens!: DeviceToken[];

  /**
   * The seller's own allowance, before any package adds to it.
   *
   * `listingLimit` is derived — base plus the slots of every active package — and
   * recomputed by `PackagesService.reconcileListingLimit`. Splitting the two is
   * what stops the three writers that used to share one number from fighting: a
   * package activating, a package expiring, and an admin setting a limit by hand.
   */
  @Prop({ type: Number, default: 10 })
  baseListingLimit!: number;

  /** Effective allowance: `baseListingLimit` + slots from active packages. */
  @Prop({ type: Number, default: 10 })
  listingLimit!: number;

  /**
   * When this seller first held more live listings than their limit allows.
   *
   * Happens when ad slots expire under listings that are still running. Their ads
   * are left alone and they are warned instead, so they choose what to drop — or
   * buy more slots — rather than having ads pulled without notice. Cleared as soon
   * as they are back within the limit.
   */
  @Prop({ type: Date, default: null })
  overLimitSince?: Date;

  @Prop({ type: Number, default: 0 })
  activeListingCount!: number;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  /**
   * How many reports against this user an admin has upheld. Denormalised
   * counter (like `activeListingCount`) so the suspension threshold can be
   * checked without re-counting the reports collection on every approval.
   */
  @Prop({ type: Number, default: 0 })
  reportCount!: number;

  /**
   * When a suspension lifts. Set when the account is suspended (e.g. 3 months
   * out for exceeding the report threshold); login compares against it so the
   * account comes back automatically rather than needing a manual unsuspend.
   */
  @Prop({ type: Date })
  suspendedUntil?: Date;

  /** Human-readable reason shown to the user / admin for the suspension. */
  @Prop({ type: String })
  suspensionReason?: string;

  /**
   * Denormalized seller rating: average of this user's APPROVED reviews (1 dp)
   * and the count behind it. Kept on the user so seller cards, profiles, and
   * JSON-LD can show a rating without an aggregation per render. Recomputed by
   * ReviewsService whenever a review is created, moderated, or auto-approved.
   */
  @Prop({ type: Number, default: 0 })
  averageRating!: number;

  @Prop({ type: Number, default: 0 })
  reviewCount!: number;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: String })
  lastLoginDevice?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ 'socialLogins.provider': 1, 'socialLogins.providerId': 1 });
