import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/core/auth/auth_provider.dart';
import 'package:marketplace_mobile/features/profile/edit_profile_screen.dart';
import 'package:marketplace_mobile/models/user.dart';

User _testUser() => User(
      id: '123',
      email: 'test@example.com',
      role: UserRole.seller,
      profile: const UserProfile(
        firstName: 'John',
        lastName: 'Doe',
        city: 'Lahore',
      ),
      emailVerified: true,
      phoneVerified: true,
      mfa: const MfaSettings(),
      notificationPreferences: const NotificationPreferences(),
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
  group('EditProfileScreen', () {
    testWidgets('renders form with pre-filled user data', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const EditProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);

      // Check pre-filled values
      final firstNameField = tester.widget<TextFormField>(
        find.widgetWithText(TextFormField, 'First Name'),
      );
      expect(
        (firstNameField.controller as TextEditingController).text,
        'John',
      );

      final lastNameField = tester.widget<TextFormField>(
        find.widgetWithText(TextFormField, 'Last Name'),
      );
      expect(
        (lastNameField.controller as TextEditingController).text,
        'Doe',
      );

      final cityField = tester.widget<TextFormField>(
        find.widgetWithText(TextFormField, 'City'),
      );
      expect(
        (cityField.controller as TextEditingController).text,
        'Lahore',
      );
    });

    testWidgets('shows validation error when first name is empty',
        (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const EditProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      // Clear first name
      await tester.enterText(
        find.widgetWithText(TextFormField, 'First Name'),
        '',
      );
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      expect(find.text('Required'), findsWidgets);
    });

    testWidgets('has avatar picker', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const EditProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('avatar-picker')), findsOneWidget);
      expect(find.byIcon(Icons.camera_alt), findsOneWidget);
    });

    testWidgets('shows person icon when no avatar', (tester) async {
      final user = _testUser();
      await tester.pumpWidget(_createTestWidget(
        child: const EditProfileScreen(),
        overrides: [
          authProvider.overrideWith(
            (ref) => FakeAuthNotifier(
                AuthState(user: user, isAuthenticated: true)),
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.person), findsOneWidget);
    });
  });
}
