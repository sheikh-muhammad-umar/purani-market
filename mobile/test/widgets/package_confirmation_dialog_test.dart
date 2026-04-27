import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/widgets/package_confirmation_dialog.dart';

Widget _testApp({required Widget child}) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  group('PackageConfirmationDialog', () {
    testWidgets('displays delete warning with package details',
        (tester) async {
      bool? result;

      await tester.pumpWidget(_testApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await PackageConfirmationDialog.show(
                context: context,
                packageName: 'Gold Package',
                packageType: 'featured_ads',
                actionType: 'delete',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Delete Listing'), findsOneWidget);
      expect(find.textContaining("'Gold Package'"), findsOneWidget);
      expect(find.textContaining('(featured_ads)'), findsOneWidget);
      expect(find.textContaining('non-recoverable'), findsOneWidget);
      expect(find.textContaining('delete this listing'), findsOneWidget);
      expect(find.text('Delete'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      // Confirm
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      expect(result, true);
    });

    testWidgets('displays deactivate warning with package details',
        (tester) async {
      bool? result;

      await tester.pumpWidget(_testApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await PackageConfirmationDialog.show(
                context: context,
                packageName: 'Silver Package',
                packageType: 'ad_slots',
                actionType: 'deactivate',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Deactivate Listing'), findsOneWidget);
      expect(find.textContaining("'Silver Package'"), findsOneWidget);
      expect(find.textContaining('(ad_slots)'), findsOneWidget);
      expect(find.textContaining('non-recoverable'), findsOneWidget);
      expect(find.textContaining('deactivate this listing'), findsOneWidget);
      expect(find.text('Deactivate'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);

      // Cancel
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(result, false);
    });

    testWidgets('returns null when dismissed by tapping outside',
        (tester) async {
      bool? result;

      await tester.pumpWidget(_testApp(
        child: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await PackageConfirmationDialog.show(
                context: context,
                packageName: 'Test',
                packageType: 'featured_ads',
                actionType: 'delete',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // Tap outside the dialog to dismiss
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(result, isNull);
    });
  });
}
