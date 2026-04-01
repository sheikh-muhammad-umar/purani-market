import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/listing.dart';
import '../../models/review.dart';
import '../../models/user.dart';

class ListingDetailState {
  final Listing? listing;
  final User? seller;
  final List<Review> reviews;
  final double averageRating;
  final bool isFavorited;
  final bool isLoading;
  final String? error;

  const ListingDetailState({
    this.listing,
    this.seller,
    this.reviews = const [],
    this.averageRating = 0,
    this.isFavorited = false,
    this.isLoading = false,
    this.error,
  });

  ListingDetailState copyWith({
    Listing? listing,
    User? seller,
    List<Review>? reviews,
    double? averageRating,
    bool? isFavorited,
    bool? isLoading,
    String? error,
  }) {
    return ListingDetailState(
      listing: listing ?? this.listing,
      seller: seller ?? this.seller,
      reviews: reviews ?? this.reviews,
      averageRating: averageRating ?? this.averageRating,
      isFavorited: isFavorited ?? this.isFavorited,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ListingDetailNotifier extends StateNotifier<ListingDetailState> {
  final ApiClient _api;

  ListingDetailNotifier({required ApiClient api})
      : _api = api,
        super(const ListingDetailState());

  Future<void> loadListing(String id) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/listings/$id');
      final listing = Listing.fromJson(response.data as Map<String, dynamic>);

      // Load reviews
      final reviewsResponse = await _api.get('/reviews/listing/$id');
      final reviewsData = reviewsResponse.data as Map<String, dynamic>;
      final reviews = (reviewsData['reviews'] as List? ?? [])
          .map((e) => Review.fromJson(e as Map<String, dynamic>))
          .toList();
      final avgRating = (reviewsData['averageRating'] as num?)?.toDouble() ?? 0;

      state = state.copyWith(
        listing: listing,
        reviews: reviews,
        averageRating: avgRating,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> toggleFavorite() async {
    final listing = state.listing;
    if (listing == null) return;

    final wasFavorited = state.isFavorited;
    state = state.copyWith(isFavorited: !wasFavorited);

    try {
      if (wasFavorited) {
        await _api.delete('/favorites/${listing.id}');
      } else {
        await _api.post('/favorites', data: {
          'productListingId': listing.id,
        });
      }
    } catch (_) {
      state = state.copyWith(isFavorited: wasFavorited);
    }
  }
}

final listingDetailProvider = StateNotifierProvider.family<
    ListingDetailNotifier, ListingDetailState, String>((ref, id) {
  final notifier = ListingDetailNotifier(api: ref.watch(apiClientProvider));
  notifier.loadListing(id);
  return notifier;
});
