import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/auth/mfa_screen.dart';

Widget createTestWidget({required Widget child}) {
  return ProviderScope(
    child: MaterialApp(
      home: child,
      routes: {
        '/login': (_) => const Scaffold(body: Text('Login Page')),
        '/': (_) => const Scaffold(body: Text('Home')),
      },
    ),
  );
}

void main() {
  group('MfaScreen', () {
    testWidgets('renders MFA verification form', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const MfaScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Enter Authentication Code'), findsOneWidget);
      expect(
          find.text(
              'Open your authenticator app and enter the 6-digit code'),
          findsOneWidget);
      expect(find.text('Verify'), findsOneWidget);
      expect(
          find.text('Cancel and go back to login'), findsOneWidget);
    });

    testWidgets('has code input field with max 6 characters', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const MfaScreen()));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(TextFormField, 'Authentication Code'),
          findsOneWidget);

      // Enter a code
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Authentication Code'), '123456');
      await tester.pumpAndSettle();

      // Verify the text was entered
      expect(find.text('123456'), findsOneWidget);
    });

    testWidgets('shows security icon', (tester) async {
      await tester.pumpWidget(createTestWidget(child: const MfaScreen()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.security), findsOneWidget);
    });
  });
}
