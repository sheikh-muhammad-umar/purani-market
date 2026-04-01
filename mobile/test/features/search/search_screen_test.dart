import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/search/search_provider.dart';
import 'package:marketplace_mobile/features/search/search_screen.dart';

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
  group('SearchScreen - UI', () {
    testWidgets('renders search text field', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const SearchScreen(),
        overrides: [
          searchProvider.overrideWith((ref) {
            final notifier = SearchNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('renders filter and sort action buttons', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const SearchScreen(),
        overrides: [
          searchProvider.overrideWith((ref) {
            final notifier = SearchNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.byIcon(Icons.tune), findsOneWidget);
      expect(find.byIcon(Icons.sort), findsOneWidget);
    });

    testWidgets('shows hint text in search field', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const SearchScreen(),
        overrides: [
          searchProvider.overrideWith((ref) {
            final notifier = SearchNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Search for anything...'), findsOneWidget);
    });
  });

  group('SearchFilters', () {
    test('default filters have relevance sort', () {
      const filters = SearchFilters();
      expect(filters.sort, SortOption.relevance);
    });

    test('toQueryParams includes category when set', () {
      const filters = SearchFilters(categoryId: 'cat123');
      final params = filters.toQueryParams();
      expect(params['categoryId'], 'cat123');
    });

    test('toQueryParams includes price range when set', () {
      const filters = SearchFilters(priceMin: 1000, priceMax: 50000);
      final params = filters.toQueryParams();
      expect(params['priceMin'], '1000.0');
      expect(params['priceMax'], '50000.0');
    });

    test('toQueryParams includes condition when set', () {
      const filters = SearchFilters(condition: 'used');
      final params = filters.toQueryParams();
      expect(params['condition'], 'used');
    });

    test('toQueryParams includes sort option', () {
      const filters = SearchFilters(sort: SortOption.newest);
      final params = filters.toQueryParams();
      expect(params['sort'], 'newest');
    });

    test('toQueryParams includes category filters with prefix', () {
      const filters = SearchFilters(
        categoryFilters: {'fuel_type': 'Petrol'},
      );
      final params = filters.toQueryParams();
      expect(params['filter_fuel_type'], 'Petrol');
    });

    test('activeFilterChips returns condition chip', () {
      const filters = SearchFilters(condition: 'used');
      final chips = filters.activeFilterChips;
      expect(chips, hasLength(1));
      expect(chips.first.key, 'condition');
      expect(chips.first.value, 'used');
    });

    test('activeFilterChips returns price chip when price set', () {
      const filters = SearchFilters(priceMin: 1000, priceMax: 50000);
      final chips = filters.activeFilterChips;
      expect(chips.any((c) => c.key == 'price'), isTrue);
    });

    test('activeFilterChips returns category filter chips', () {
      const filters = SearchFilters(
        categoryFilters: {'fuel_type': 'Petrol', 'mileage': '50000'},
      );
      final chips = filters.activeFilterChips;
      expect(chips.where((c) => c.key.startsWith('cf_')), hasLength(2));
    });

    test('activeFilterChips is empty for default filters', () {
      const filters = SearchFilters();
      expect(filters.activeFilterChips, isEmpty);
    });

    test('copyWith clears condition', () {
      const filters = SearchFilters(condition: 'used');
      final cleared = filters.copyWith(clearCondition: true);
      expect(cleared.condition, isNull);
    });

    test('copyWith clears price range', () {
      const filters = SearchFilters(priceMin: 1000, priceMax: 50000);
      final cleared = filters.copyWith(clearPrice: true);
      expect(cleared.priceMin, isNull);
      expect(cleared.priceMax, isNull);
    });

    test('copyWith clears category', () {
      const filters = SearchFilters(categoryId: 'cat1');
      final cleared = filters.copyWith(clearCategory: true);
      expect(cleared.categoryId, isNull);
    });

    test('copyWith updates sort option', () {
      const filters = SearchFilters();
      final updated = filters.copyWith(sort: SortOption.priceLowHigh);
      expect(updated.sort, SortOption.priceLowHigh);
    });
  });

  group('SearchState', () {
    test('initial state has empty query and no results', () {
      const state = SearchState();
      expect(state.query, isEmpty);
      expect(state.results, isEmpty);
      expect(state.hasSearched, isFalse);
      expect(state.isLoading, isFalse);
    });

    test('copyWith updates query', () {
      const state = SearchState();
      final updated = state.copyWith(query: 'Toyota');
      expect(updated.query, 'Toyota');
    });

    test('copyWith updates loading state', () {
      const state = SearchState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates hasSearched', () {
      const state = SearchState();
      final searched = state.copyWith(hasSearched: true);
      expect(searched.hasSearched, isTrue);
    });
  });

  group('SortOption', () {
    test('all sort options are defined', () {
      expect(SortOption.values, hasLength(4));
      expect(SortOption.values, contains(SortOption.relevance));
      expect(SortOption.values, contains(SortOption.newest));
      expect(SortOption.values, contains(SortOption.priceLowHigh));
      expect(SortOption.values, contains(SortOption.priceHighLow));
    });

    test('sort option names match expected strings', () {
      expect(SortOption.relevance.name, 'relevance');
      expect(SortOption.newest.name, 'newest');
      expect(SortOption.priceLowHigh.name, 'priceLowHigh');
      expect(SortOption.priceHighLow.name, 'priceHighLow');
    });
  });
}
