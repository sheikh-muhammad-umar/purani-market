export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar: string;
  location: GeoPoint;
  city: string;
  postalCode: string;
}

export interface SocialLogin {
  provider: 'google' | 'facebook';
  providerId: string;
}

export interface MfaSettings {
  enabled: boolean;
  totpSecret?: string;
  failedAttempts: number;
  lockedUntil?: Date;
}

export interface PendingEmailChange {
  newEmail: string;
  verificationToken: string;
  expiresAt: Date;
}

export interface PendingPhoneChange {
  newPhone: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
}

export interface VerificationChangeCount {
  count: number;
  resetAt: Date;
}

export interface NotificationPreferences {
  messages: boolean;
  offers: boolean;
  productUpdates: boolean;
  promotions: boolean;
  packageAlerts: boolean;
}

export interface DeviceToken {
  platform: string;
  token: string;
}

export type UserRole = 'admin' | 'seller' | 'buyer';
export type UserStatus = 'active' | 'suspended';

export interface User {
  _id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  profile: UserProfile;
  emailVerified: boolean;
  phoneVerified: boolean;
  pendingEmailChange?: PendingEmailChange;
  pendingPhoneChange?: PendingPhoneChange;
  verificationChangeCount?: VerificationChangeCount;
  socialLogins: SocialLogin[];
  mfa: MfaSettings;
  notificationPreferences: NotificationPreferences;
  deviceTokens: DeviceToken[];
  adLimit: number;
  activeAdCount: number;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  lastLoginDevice?: string;
}
