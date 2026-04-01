import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

enum UserRole {
  @JsonValue('admin')
  admin,
  @JsonValue('seller')
  seller,
  @JsonValue('buyer')
  buyer,
}

enum UserStatus {
  @JsonValue('active')
  active,
  @JsonValue('suspended')
  suspended,
}

@JsonSerializable()
class GeoPoint {
  final String type;
  final List<double> coordinates; // [lng, lat]

  const GeoPoint({this.type = 'Point', required this.coordinates});

  factory GeoPoint.fromJson(Map<String, dynamic> json) =>
      _$GeoPointFromJson(json);
  Map<String, dynamic> toJson() => _$GeoPointToJson(this);
}

@JsonSerializable()
class UserProfile {
  final String firstName;
  final String lastName;
  final String avatar;
  final GeoPoint? location;
  final String city;
  final String postalCode;

  const UserProfile({
    required this.firstName,
    required this.lastName,
    this.avatar = '',
    this.location,
    this.city = '',
    this.postalCode = '',
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) =>
      _$UserProfileFromJson(json);
  Map<String, dynamic> toJson() => _$UserProfileToJson(this);
}

@JsonSerializable()
class SocialLogin {
  final String provider; // 'google' | 'facebook'
  final String providerId;

  const SocialLogin({required this.provider, required this.providerId});

  factory SocialLogin.fromJson(Map<String, dynamic> json) =>
      _$SocialLoginFromJson(json);
  Map<String, dynamic> toJson() => _$SocialLoginToJson(this);
}

@JsonSerializable()
class MfaSettings {
  final bool enabled;
  final int failedAttempts;
  final DateTime? lockedUntil;

  const MfaSettings({
    this.enabled = false,
    this.failedAttempts = 0,
    this.lockedUntil,
  });

  factory MfaSettings.fromJson(Map<String, dynamic> json) =>
      _$MfaSettingsFromJson(json);
  Map<String, dynamic> toJson() => _$MfaSettingsToJson(this);
}

@JsonSerializable()
class NotificationPreferences {
  final bool messages;
  final bool offers;
  final bool productUpdates;
  final bool promotions;
  final bool packageAlerts;

  const NotificationPreferences({
    this.messages = true,
    this.offers = true,
    this.productUpdates = true,
    this.promotions = true,
    this.packageAlerts = true,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      _$NotificationPreferencesFromJson(json);
  Map<String, dynamic> toJson() => _$NotificationPreferencesToJson(this);
}

@JsonSerializable()
class DeviceToken {
  final String platform;
  final String token;

  const DeviceToken({required this.platform, required this.token});

  factory DeviceToken.fromJson(Map<String, dynamic> json) =>
      _$DeviceTokenFromJson(json);
  Map<String, dynamic> toJson() => _$DeviceTokenToJson(this);
}

@JsonSerializable()
class PendingEmailChange {
  final String newEmail;
  final String verificationToken;
  final DateTime expiresAt;

  const PendingEmailChange({
    required this.newEmail,
    required this.verificationToken,
    required this.expiresAt,
  });

  factory PendingEmailChange.fromJson(Map<String, dynamic> json) =>
      _$PendingEmailChangeFromJson(json);
  Map<String, dynamic> toJson() => _$PendingEmailChangeToJson(this);
}

@JsonSerializable()
class PendingPhoneChange {
  final String newPhone;
  final String otpHash;
  final DateTime expiresAt;
  final int attempts;

  const PendingPhoneChange({
    required this.newPhone,
    required this.otpHash,
    required this.expiresAt,
    this.attempts = 0,
  });

  factory PendingPhoneChange.fromJson(Map<String, dynamic> json) =>
      _$PendingPhoneChangeFromJson(json);
  Map<String, dynamic> toJson() => _$PendingPhoneChangeToJson(this);
}

@JsonSerializable()
class VerificationChangeCount {
  final int count;
  final DateTime resetAt;

  const VerificationChangeCount({required this.count, required this.resetAt});

  factory VerificationChangeCount.fromJson(Map<String, dynamic> json) =>
      _$VerificationChangeCountFromJson(json);
  Map<String, dynamic> toJson() => _$VerificationChangeCountToJson(this);
}

@JsonSerializable()
class User {
  @JsonKey(name: '_id')
  final String id;
  final String? email;
  final String? phone;
  final UserRole role;
  final UserProfile profile;
  final bool emailVerified;
  final bool phoneVerified;
  final PendingEmailChange? pendingEmailChange;
  final PendingPhoneChange? pendingPhoneChange;
  final VerificationChangeCount? verificationChangeCount;
  final List<SocialLogin> socialLogins;
  final MfaSettings mfa;
  final NotificationPreferences notificationPreferences;
  final List<DeviceToken> deviceTokens;
  final int adLimit;
  final int activeAdCount;
  final UserStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? lastLoginAt;
  final String? lastLoginDevice;

  const User({
    required this.id,
    this.email,
    this.phone,
    required this.role,
    required this.profile,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.pendingEmailChange,
    this.pendingPhoneChange,
    this.verificationChangeCount,
    this.socialLogins = const [],
    required this.mfa,
    required this.notificationPreferences,
    this.deviceTokens = const [],
    this.adLimit = 10,
    this.activeAdCount = 0,
    this.status = UserStatus.active,
    required this.createdAt,
    required this.updatedAt,
    this.lastLoginAt,
    this.lastLoginDevice,
  });

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}
