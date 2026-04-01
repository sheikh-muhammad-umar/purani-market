import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/auth/forgot_password_screen.dart';

Widget createTestWidget({required Widget child}) {
  return ProviderScope(
    child: MaterialApp(
      home: child,
      routes: {
        '/login': (_) => const Scaffold(body: Text('Login Page')),
      },
    ),
  );
}

void main() {
  group('ForgotPasswordScreen', () {
    testWidgets('renders forgot password form', (tester) async {
      await tester.pumpWidget(
          createTestWidget(child: const ForgotPasswordScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Forgot Password'), findsOneWidget);
      expect(
          find.text("Enter your email and we'll send you a reset link"),
          findsOneWidget);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Send Reset Link'), findsOneWidget);
    });

    testWidgets('validates empty email', (tester) async {
      await tester.pumpWidget(
          createTestWidget(child: const ForgotPasswordScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Send Reset Link'));
      await tester.pumpAndSettle();

      expect(find.text('Email is required'), findsOneWidget);
    });

    testWidgets('validates invalid email format', (tester) async {
      await tester.pumpWidget(
          createTestWidget(child: const ForgotPasswordScreen()));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'Email'), 'not-an-email');
      await tester.tap(find.text('Send Reset Link'));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid email'), findsOneWidget);
    });
  });
}
