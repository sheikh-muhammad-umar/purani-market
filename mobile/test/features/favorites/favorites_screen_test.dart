import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/favorites/favorites_provider.dart';
import 'package:marketplace_mobile/features/favorites/favorites_screen.dart';
import 'package:marketplace_mobile/models/favorite.dart';
import 'package:marketplace_mobile/models/listing.dart';

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
  group('FavoritesScreen - UI', () {
    testWidgets('renders Favorites title in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const FavoritesScreen(),
        overrides: [
          favoritesProvider.overrideWith((ref) {
            return FavoritesNotifier(api: throw UnimplementedError());
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Favorites'), findsOneWidget);
    });
  });

  group('FavoritesState', () {
    test('initial state has empty favorites and is not loading', () {
      const state = FavoritesState();
      expect(state.favorites, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates loading state', () {
      const state = FavoritesState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = FavoritesState();
      final withError = state.copyWith(error: 'Failed');
      expect(withError.error, 'Failed');
    });
  });

  group('FavoriteWithListing', () {
    test('holds favorite and listing data', () {
      final favorite = Favorite(
        id: 'fav-1',
        userId: 'user-1',
        productListingId: 'listing-1',
        createdAt: DateTime.now(),
      );
      final listing = Listing(
        id: 'listing-1',
        sellerId: 'seller-1',
        title: 'Test Item',
        description: 'A test listing',
        price: const ListingPrice(amount: 5000),
        categoryId: 'cat-1',
        condition: ListingCondition.used,
        location: const ListingLocation(
          coordinates: [74.3, 31.5],
          city: 'Lahore',
          area: 'Gulberg',
        ),
        contactInfo: const ListingContactInfo(
          phone: '+923001234567',
          email: 'test@example.com',
        ),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final item = FavoriteWithListing(favorite: favorite, listing: listing);
      expect(item.favorite.id, 'fav-1');
      expect(item.listing.title, 'Test Item');
      expect(item.listing.price.amount, 5000);
      expect(item.listing.status, ListingStatus.active);
    });
  });
}
