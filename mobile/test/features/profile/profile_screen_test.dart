import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/core/auth/auth_provider.dart';
import 'package:marketplace_mobile/features/profile/profile_screen.dart';
import 'package:marketplace_mobile/features/profile/edit_profile_screen.dart';
import 'package:marketplace_mobile/features/profile/settings_screen.dart';
import 'package:marketplace_mobile/models/user.dart';

User _testUser() => User(
      id: '123',
      email: 'test@example.com',
      phone: '+923001234567',
      role: UserRole.seller,
      profile: const UserProfile(
        firstName: 'John',
        lastName: 'Doe',
        avatar: '',
        city: 'Lahore',
      ),
      emailVerified: true,
      phoneVerified: false,
      mfa: const MfaSettings(),
      notificationPreferences: const NotificationPreferences(),
      createdAt: DateTime(2024, 1, 15),
      updatedAt: DateTime(2024, 6, 1),
    );

Widget _createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: child,
      routes: {
        '/settings': (_) => const SettingsScreen(),
        '/profile/edit': (_) => const EditProfileScreen(),
      },
    ),
  );
}

/// Fake AuthNotifier that exposes a fixed state without needing real API/token deps.
class FakeAuthNotifier extends AuthNotifier {
  final AuthState _fixedState;

  FakeAuthNotifier(this._fixedState)
      : super(
          api: _ThrowApiClient(),
          tokenStorage: _ThrowTokenStorage(),
        ) {
    state = _fixedState;
  }

  @override
  Future<void> initialize() async {}

  @override
  Future<void> logout() async {
    state = const AuthState();
  }
}

/// Stubs that throw if actually called — tests don't hit the network.
class _ThrowApiClient implements dynamic {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _ThrowTokenStorage implements dynamic {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  group('ProfileScreen', () {
    testWidgets('shows "Please log in" when user is null', (tester) async {
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(const AuthState()),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Please log in'), findsOneWidget);
    });

    testWidgets('displays user info when authenticated', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('John Doe'), findsOneWidget);
      expect(find.text('SELLER'), findsOneWidget);
      expect(find.text('test@example.com'), findsOneWidget);
      expect(find.text('+923001234567'), findsOneWidget);
      expect(find.text('Lahore'), findsOneWidget);
      expect(find.text('Jan 15, 2024'), findsOneWidget);
    });

    testWidgets('shows initials when avatar is empty', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('JD'), findsOneWidget);
    });

    testWidgets('shows verified/unverified icons for email and phone',
        (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      // Email is verified, phone is not
      expect(find.byIcon(Icons.verified), findsOneWidget);
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('has Edit Profile and Logout buttons', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.text('Logout'), findsOneWidget);
    });

    testWidgets('has settings button in app bar', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const ProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('settings-button')), findsOneWidget);
    });
  });
}
