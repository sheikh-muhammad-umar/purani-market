import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/home/home_provider.dart';
import 'package:marketplace_mobile/features/home/home_screen.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: child),
  );
}

void main() {
  group('HomeScreen - UI', () {
    testWidgets('renders app bar with Marketplace title', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const HomeScreen(),
        overrides: [
          homeProvider.overrideWith((ref) {
            final notifier = HomeNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Marketplace'), findsOneWidget);
    });

    testWidgets('renders notification icon in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const HomeScreen(),
        overrides: [
          homeProvider.overrideWith((ref) {
            final notifier = HomeNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
    });
  });

  group('HomeState', () {
    test('initial state has empty lists and is not loading', () {
      const state = HomeState();
      expect(state.categories, isEmpty);
      expect(state.featuredAds, isEmpty);
      expect(state.recommendations, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates loading state', () {
      const state = HomeState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = HomeState();
      final withError = state.copyWith(error: 'Failed to load');
      expect(withError.error, 'Failed to load');
    });

    test('copyWith preserves existing values', () {
      const state = HomeState(isLoading: true);
      final updated = state.copyWith(error: 'Error');
      expect(updated.isLoading, isTrue);
      expect(updated.error, 'Error');
    });
  });
}
