import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  SELLER = 'seller',  // kept for backward compatibility, treated same as 'user'
  BUYER = 'buyer',    // kept for backward compatibility, treated same as 'user'
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

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
  @Prop({ type: String, enum: ['google', 'facebook'], required: true })
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

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id!: Types.ObjectId;

  @Prop({ type: String, unique: true, sparse: true })
  email?: string;

  @Prop({ type: String, unique: true, sparse: true })
  phone?: string;

  @Prop({ type: String })
  passwordHash?: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Prop({ type: UserProfile, default: () => ({}) })
  profile!: UserProfile;

  @Prop({ type: Boolean, default: false })
  emailVerified!: boolean;

  @Prop({ type: Boolean, default: false })
  phoneVerified!: boolean;

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

  @Prop({ type: Number, default: 10 })
  adLimit!: number;

  @Prop({ type: Number, default: 0 })
  activeAdCount!: number;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: String })
  lastLoginDevice?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ 'socialLogins.provider': 1, 'socialLogins.providerId': 1 });
