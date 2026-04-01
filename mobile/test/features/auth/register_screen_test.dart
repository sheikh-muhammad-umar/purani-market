import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/auth/register_screen.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: child,
      routes: {
        '/login': (_) => const Scaffold(body: Text('Login Page')),
        '/verification': (_) => const Scaffold(body: Text('Verification')),
      },
    ),
  );
}

void main() {
  group('RegisterScreen', () {
    testWidgets('renders registration form with email mode by default',
        (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Create Account'), findsOneWidget);
      expect(find.text('Join the marketplace'), findsOneWidget);
      expect(find.text('Email'), findsWidgets); // segment + field
      expect(find.text('Phone'), findsOneWidget); // segment
      expect(find.text('First Name'), findsOneWidget);
      expect(find.text('Last Name'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Create Account'), findsOneWidget);
    });

    testWidgets('shows email field in email mode', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
      expect(
          find.widgetWithText(TextFormField, 'Phone Number'), findsNothing);
    });

    testWidgets('switches to phone mode when phone segment tapped',
        (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      // Tap the Phone segment
      await tester.tap(find.text('Phone'));
      await tester.pumpAndSettle();

      expect(
          find.widgetWithText(TextFormField, 'Phone Number'), findsOneWidget);
    });

    testWidgets('validates required fields on submit', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ElevatedButton, 'Create Account'));
      await tester.pumpAndSettle();

      expect(find.text('First name is required'), findsOneWidget);
      expect(find.text('Last name is required'), findsOneWidget);
      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('validates email format', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'First Name'), 'John');
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Last Name'), 'Doe');
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Email'), 'invalid-email');
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Password'), 'password123');

      await tester.tap(find.widgetWithText(ElevatedButton, 'Create Account'));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid email'), findsOneWidget);
    });

    testWidgets('shows social login buttons', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Google'), findsOneWidget);
      expect(find.text('Facebook'), findsOneWidget);
      expect(find.text('or sign up with'), findsOneWidget);
    });

    testWidgets('has link to sign in page', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const RegisterScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Already have an account?'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
    });
  });
}
