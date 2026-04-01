import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/auth/verification_screen.dart';

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
  group('VerificationScreen', () {
    testWidgets('renders verification form with phone number', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const VerificationScreen(phone: '+923001234567'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Enter Verification Code'), findsOneWidget);
      expect(find.text('We sent a 6-digit code to +923001234567'),
          findsOneWidget);
      expect(find.text('Verify'), findsOneWidget);
      expect(find.text('Resend Code'), findsOneWidget);
    });

    testWidgets('shows error for incomplete OTP', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const VerificationScreen(phone: '+923001234567'),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'Verification Code'), '123');
      await tester.tap(find.text('Verify'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a 6-digit code'), findsOneWidget);
    });

    testWidgets('renders with email', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const VerificationScreen(email: 'test@example.com'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('We sent a 6-digit code to test@example.com'),
          findsOneWidget);
    });
  });
}
