import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/user.dart';
import '../api/api_client.dart';
import '../api/token_storage.dart';

/// Authentication state.
class AuthState {
  final User? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;
  final bool mfaPending;
  final String? mfaSessionToken;

  const AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
    this.mfaPending = false,
    this.mfaSessionToken,
  });

  AuthState copyWith({
    User? user,
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
    bool? mfaPending,
    String? mfaSessionToken,
  }) {
    return AuthState(
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      mfaPending: mfaPending ?? this.mfaPending,
      mfaSessionToken: mfaSessionToken ?? this.mfaSessionToken,
    );
  }
}

/// Manages authentication state, login, register, social login, MFA, and password recovery.
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;
  final TokenStorage _tokenStorage;

  AuthNotifier({required ApiClient api, required TokenStorage tokenStorage})
      : _api = api,
        _tokenStorage = tokenStorage,
        super(const AuthState());

  /// Initialize auth state from stored tokens.
  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);
    try {
      final hasTokens = await _tokenStorage.hasTokens();
      if (hasTokens) {
        final response = await _api.get('/users/me');
        final user = User.fromJson(response.data as Map<String, dynamic>);
        state = AuthState(user: user, isAuthenticated: true);
      } else {
        state = const AuthState();
      }
    } catch (_) {
      await _tokenStorage.clearTokens();
      state = const AuthState();
    }
  }

  /// Login with email/phone and password.
  Future<void> login({required String identifier, required String password}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.post('/auth/login', data: {
        'identifier': identifier,
        'password': password,
      });
      final data = response.data as Map<String, dynamic>;

      if (data['mfaRequired'] == true) {
        state = state.copyWith(
          isLoading: false,
          mfaPending: true,
          mfaSessionToken: data['mfaSessionToken'] as String?,
        );
        return;
      }

      await _handleAuthResponse(data);
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _extractError(e),
      );
    }
  }

  /// Register with email.
  Future<void> registerWithEmail({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _api.post('/auth/register', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      });
      state = state.copyWith(isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  /// Register with phone.
  Future<void> registerWithPhone({
    required String phone,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _api.post('/auth/register', data: {
        'phone': phone,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      });
      state = state.copyWith(isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  /// Social login (Google or Facebook).
  Future<void> socialLogin({
    required String provider,
    required String accessToken,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.post('/auth/social-login', data: {
        'provider': provider,
        'accessToken': accessToken,
      });
      await _handleAuthResponse(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  /// Verify MFA code.
  Future<void> verifyMfa({required String code}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.post('/auth/mfa/verify', data: {
        'code': code,
        'mfaSessionToken': state.mfaSessionToken,
      });
      await _handleAuthResponse(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  /// Verify email with token.
  Future<bool> verifyEmail({required String token}) async {
    try {
      await _api.post('/auth/verify-email', data: {'token': token});
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Verify phone with OTP.
  Future<bool> verifyPhone({required String phone, required String otp}) async {
    try {
      await _api.post('/auth/verify-phone', data: {
        'phone': phone,
        'otp': otp,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Resend verification email or SMS.
  Future<bool> resendVerification({String? email, String? phone}) async {
    try {
      await _api.post('/auth/resend-verification', data: {
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Request password reset.
  Future<bool> forgotPassword({required String email}) async {
    try {
      await _api.post('/auth/forgot-password', data: {'email': email});
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Reset password with token.
  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      await _api.post('/auth/reset-password', data: {
        'token': token,
        'newPassword': newPassword,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Logout and clear tokens.
  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Logout even if API call fails
    }
    await _tokenStorage.clearTokens();
    state = const AuthState();
  }

  Future<void> _handleAuthResponse(Map<String, dynamic> data) async {
    await _tokenStorage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    final userJson = data['user'] as Map<String, dynamic>?;
    User? user;
    if (userJson != null) {
      user = User.fromJson(userJson);
    } else {
      // Fetch user profile
      final profileResponse = await _api.get('/users/me');
      user = User.fromJson(profileResponse.data as Map<String, dynamic>);
    }
    state = AuthState(user: user, isAuthenticated: true);
  }

  String _extractError(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      return data['message'] as String? ?? 'An error occurred';
    }
    return 'Network error. Please try again.';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    api: ref.watch(apiClientProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});
