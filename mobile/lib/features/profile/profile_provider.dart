import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../models/user.dart';

/// State for profile operations (edit, email/phone change, notification prefs).
class ProfileState {
  final bool isLoading;
  final String? error;
  final String? successMessage;
  final bool verificationSent;

  const ProfileState({
    this.isLoading = false,
    this.error,
    this.successMessage,
    this.verificationSent = false,
  });

  ProfileState copyWith({
    bool? isLoading,
    String? error,
    String? successMessage,
    bool? verificationSent,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      successMessage: successMessage,
      verificationSent: verificationSent ?? this.verificationSent,
    );
  }
}

class ProfileNotifier extends StateNotifier<ProfileState> {
  final ApiClient _api;
  final AuthNotifier _authNotifier;

  ProfileNotifier({
    required ApiClient api,
    required AuthNotifier authNotifier,
  })  : _api = api,
        _authNotifier = authNotifier,
        super(const ProfileState());

  /// Update profile (name, avatar, location).
  Future<void> updateProfile({
    String? firstName,
    String? lastName,
    String? city,
    String? avatarBase64,
  }) async {
    state = state.copyWith(isLoading: true, error: null, successMessage: null);
    try {
      final data = <String, dynamic>{};
      if (firstName != null) data['firstName'] = firstName;
      if (lastName != null) data['lastName'] = lastName;
      if (city != null) data['city'] = city;
      if (avatarBase64 != null) data['avatar'] = avatarBase64;

      await _api.patch('/users/me', data: {'profile': data});
      await _authNotifier.initialize();
      state = state.copyWith(
        isLoading: false,
        successMessage: 'Profile updated successfully',
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to update profile',
      );
    }
  }

  /// Request email change — sends verification to new email.
  Future<void> changeEmail(String newEmail) async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      successMessage: null,
      verificationSent: false,
    );
    try {
      await _api.post('/auth/change-email', data: {'newEmail': newEmail});
      state = state.copyWith(
        isLoading: false,
        verificationSent: true,
        successMessage: 'Verification link sent to $newEmail',
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to request email change',
      );
    }
  }

  /// Request phone change — sends OTP to new phone.
  Future<void> changePhone(String newPhone) async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      successMessage: null,
      verificationSent: false,
    );
    try {
      await _api.post('/auth/change-phone', data: {'newPhone': newPhone});
      state = state.copyWith(
        isLoading: false,
        verificationSent: true,
        successMessage: 'OTP sent to $newPhone',
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to request phone change',
      );
    }
  }

  /// Verify phone change OTP.
  Future<void> verifyPhoneChange(String otp) async {
    state = state.copyWith(isLoading: true, error: null, successMessage: null);
    try {
      await _api.post('/auth/change-phone/verify', data: {'otp': otp});
      await _authNotifier.initialize();
      state = state.copyWith(
        isLoading: false,
        verificationSent: false,
        successMessage: 'Phone number updated successfully',
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Invalid OTP',
      );
    }
  }

  /// Update notification preferences.
  Future<void> updateNotificationPreferences(
      NotificationPreferences prefs) async {
    state = state.copyWith(isLoading: true, error: null, successMessage: null);
    try {
      await _api.patch('/users/me', data: {
        'notificationPreferences': prefs.toJson(),
      });
      await _authNotifier.initialize();
      state = state.copyWith(
        isLoading: false,
        successMessage: 'Notification preferences updated',
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Failed to update preferences',
      );
    }
  }

  void clearMessages() {
    state = state.copyWith(error: null, successMessage: null);
  }
}

final profileProvider =
    StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  return ProfileNotifier(
    api: ref.watch(apiClientProvider),
    authNotifier: ref.watch(authProvider.notifier),
  );
});
