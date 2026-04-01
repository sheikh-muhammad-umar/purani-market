import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/listings/listing_detail_provider.dart';
import 'package:marketplace_mobile/models/listing.dart';
import 'package:marketplace_mobile/models/review.dart';

void main() {
  group('ListingDetailState', () {
    test('initial state has no listing and is not loading', () {
      const state = ListingDetailState();
      expect(state.listing, isNull);
      expect(state.seller, isNull);
      expect(state.reviews, isEmpty);
      expect(state.averageRating, 0);
      expect(state.isFavorited, isFalse);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates isFavorited', () {
      const state = ListingDetailState();
      final updated = state.copyWith(isFavorited: true);
      expect(updated.isFavorited, isTrue);
    });

    test('copyWith updates loading state', () {
      const state = ListingDetailState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = ListingDetailState();
      final withError = state.copyWith(error: 'Network error');
      expect(withError.error, 'Network error');
    });

    test('copyWith updates reviews and average rating', () {
      const state = ListingDetailState();
      final reviews = [
        Review(
          id: 'r1',
          reviewerId: 'u1',
          sellerId: 's1',
          productListingId: 'l1',
          rating: 4,
          text: 'Good seller',
          createdAt: DateTime(2024),
          updatedAt: DateTime(2024),
        ),
        Review(
          id: 'r2',
          reviewerId: 'u2',
          sellerId: 's1',
          productListingId: 'l1',
          rating: 5,
          text: 'Excellent',
          createdAt: DateTime(2024),
          updatedAt: DateTime(2024),
        ),
      ];
      final updated = state.copyWith(
        reviews: reviews,
        averageRating: 4.5,
      );
      expect(updated.reviews, hasLength(2));
      expect(updated.averageRating, 4.5);
    });

    test('copyWith preserves existing values when not specified', () {
      const state = ListingDetailState(
        isFavorited: true,
        averageRating: 4.0,
      );
      final updated = state.copyWith(isLoading: true);
      expect(updated.isFavorited, isTrue);
      expect(updated.averageRating, 4.0);
      expect(updated.isLoading, isTrue);
    });
  });

  group('Listing model', () {
    test('listing has correct default values', () {
      final listing = Listing(
        id: 'l1',
        sellerId: 's1',
        title: 'Test Car',
        description: 'A nice car',
        price: const ListingPrice(amount: 500000),
        categoryId: 'cat1',
        condition: ListingCondition.used,
        location: const ListingLocation(
          coordinates: [74.3587, 31.5204],
          city: 'Lahore',
          area: 'DHA',
        ),
        contactInfo: const ListingContactInfo(
          phone: '+923001234567',
          email: 'test@test.com',
        ),
        createdAt: DateTime(2024),
        updatedAt: DateTime(2024),
      );

      expect(listing.status, ListingStatus.active);
      expect(listing.isFeatured, isFalse);
      expect(listing.viewCount, 0);
      expect(listing.favoriteCount, 0);
      expect(listing.images, isEmpty);
      expect(listing.video, isNull);
      expect(listing.categoryAttributes, isEmpty);
    });

    test('ListingPrice defaults to PKR currency', () {
      const price = ListingPrice(amount: 25000);
      expect(price.currency, 'PKR');
    });

    test('ListingLocation defaults to Point type', () {
      const loc = ListingLocation(
        coordinates: [74.3587, 31.5204],
        city: 'Lahore',
        area: 'DHA',
      );
      expect(loc.type, 'Point');
    });
  });
}
