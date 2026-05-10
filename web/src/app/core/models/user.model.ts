import { SocialProvider } from '../enums/social-provider';
import { UserRole } from '../constants/enums';
import { UserStatus } from '../constants/enums';

export { UserRole, UserStatus } from '../constants/enums';

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar: string;
  city: string;
  postalCode: string;
}

export interface SocialLogin {
  provider: SocialProvider;
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

export interface User {
  _id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  permissions?: string[];
  profile: UserProfile;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  pendingEmailChange?: PendingEmailChange;
  pendingPhoneChange?: PendingPhoneChange;
  verificationChangeCount?: VerificationChangeCount;
  socialLogins: SocialLogin[];
  mfa: MfaSettings;
  notificationPreferences: NotificationPreferences;
  deviceTokens: DeviceToken[];
  listingLimit: number;
  activeListingCount: number;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  lastLoginDevice?: string;
}
