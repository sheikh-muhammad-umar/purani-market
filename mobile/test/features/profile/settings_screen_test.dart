import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/core/auth/auth_provider.dart';
import 'package:marketplace_mobile/features/profile/settings_screen.dart';
import 'package:marketplace_mobile/models/user.dart';

User _testUser({
  bool messages = true,
  bool offers = true,
  bool productUpdates = true,
  bool promotions = false,
  bool packageAlerts = true,
}) =>
    User(
      id: '123',
      email: 'test@example.com',
      phone: '+923001234567',
      role: UserRole.seller,
      profile: const UserProfile(firstName: 'John', lastName: 'Doe'),
      emailVerified: true,
      phoneVerified: true,
      mfa: const MfaSettings(),
      notificationPreferences: NotificationPreferences(
        messages: messages,
        offers: offers,
        productUpdates: productUpdates,
        promotions: promotions,
        packageAlerts: packageAlerts,
      ),
      createdAt: DateTime(2024, 1, 15),
      updatedAt: DateTime(2024, 6, 1),
    );

class FakeAuthNotifier extends AuthNotifier {
  final AuthState _fixedState;

  FakeAuthNotifier(this._fixedState)
      : super(
          api: _Stub(),
          tokenStorage: _Stub(),
        ) {
    state = _fixedState;
  }

  @override
  Future<void> initialize() async {}
}

class _Stub implements dynamic {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: child),
  );
}

void main() {
  group('SettingsScreen', () {
    testWidgets('shows "Please log in" when user is null', (tester) async {
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(const AuthState()),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Please log in'), findsOneWidget);
    });

    testWidgets('displays Account section with email and phone',
        (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Account'), findsOneWidget);
      expect(find.text('Change Email'), findsOneWidget);
      expect(find.text('test@example.com'), findsOneWidget);
      expect(find.text('Change Phone'), findsOneWidget);
      expect(find.text('+923001234567'), findsOneWidget);
    });

    testWidgets('displays all notification toggles', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Offers'), findsOneWidget);
      expect(find.text('Product Updates'), findsOneWidget);
      expect(find.text('Promotions'), findsOneWidget);
      expect(find.text('Package Alerts'), findsOneWidget);
    });

    testWidgets('notification toggles reflect user preferences',
        (tester) async {
      final user = _testUser(promotions: false, messages: true);
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      // Find all SwitchListTile widgets
      final switches = tester.widgetList<SwitchListTile>(
        find.byType(SwitchListTile),
      );
      // Messages (index 0) should be on, Promotions (index 3) should be off
      expect(switches.elementAt(0).value, isTrue);
      expect(switches.elementAt(3).value, isFalse);
    });

    testWidgets('tapping Change Email opens dialog', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Change Email'));
      await tester.pumpAndSettle();

      expect(find.text('New Email'), findsOneWidget);
      expect(find.text('Send Verification'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('email change dialog validates empty input', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Change Email'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Send Verification'));
      await tester.pumpAndSettle();

      expect(find.text('Required'), findsOneWidget);
    });

    testWidgets('email change dialog validates invalid email', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Change Email'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), 'notanemail');
      await tester.tap(find.text('Send Verification'));
      await tester.pumpAndSettle();

      expect(find.text('Invalid email'), findsOneWidget);
    });

    testWidgets('tapping Change Phone opens dialog', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const SettingsScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Change Phone'));
      await tester.pumpAndSettle();

      expect(find.text('New Phone Number'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
    });
  });
}
