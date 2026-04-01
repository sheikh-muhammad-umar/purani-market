import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Push notification service supporting FCM (iOS/Android) and HMS (Huawei).
class NotificationService {
  FirebaseMessaging? _fcm;
  String? _deviceToken;

  String? get deviceToken => _deviceToken;

  /// Whether the current device is a Huawei device (no GMS).
  bool get isHuaweiDevice {
    // In production, check for HMS availability via huawei_hmsavailability
    return false;
  }

  /// Initialize push notification listeners.
  Future<void> initialize() async {
    if (isHuaweiDevice) {
      await _initializeHms();
    } else {
      await _initializeFcm();
    }
  }

  Future<void> _initializeFcm() async {
    _fcm = FirebaseMessaging.instance;

    // Request permission (iOS)
    await _fcm!.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    _deviceToken = await _fcm!.getToken();

    // Listen for token refresh
    _fcm!.onTokenRefresh.listen((token) {
      _deviceToken = token;
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated message taps
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);
  }

  Future<void> _initializeHms() async {
    // HMS Push Kit initialization
    // In production: use huawei_push package
    // _deviceToken = await Push.getToken('');
  }

  void _handleForegroundMessage(RemoteMessage message) {
    // Show local notification or update UI
  }

  void _handleMessageTap(RemoteMessage message) {
    // Navigate to relevant screen based on message data
  }

  /// Get the device push token for the current platform.
  Future<String?> getDeviceToken() async {
    if (_deviceToken != null) return _deviceToken;
    if (_fcm != null) {
      _deviceToken = await _fcm!.getToken();
    }
    return _deviceToken;
  }

  /// Request notification permissions from the user.
  Future<bool> requestPermission() async {
    if (_fcm == null) return false;
    final settings = await _fcm!.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }

  /// Get the platform identifier for device token registration.
  String get platform {
    if (isHuaweiDevice) return 'hms';
    if (Platform.isIOS) return 'ios';
    return 'android';
  }
}

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService();
});
