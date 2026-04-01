import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../core/storage/cache_service.dart';
import '../models/listing.dart';

/// State for listings.
class ListingsState {
  final List<Listing> listings;
  final bool isLoading;
  final String? error;

  const ListingsState({
    this.listings = const [],
    this.isLoading = false,
    this.error,
  });

  ListingsState copyWith({
    List<Listing>? listings,
    bool? isLoading,
    String? error,
  }) {
    return ListingsState(
      listings: listings ?? this.listings,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ListingsNotifier extends StateNotifier<ListingsState> {
  final ApiClient _api;
  final CacheService _storage;

  ListingsNotifier(this._api, this._storage) : super(const ListingsState());

  Future<void> fetchListings({Map<String, dynamic>? filters}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/listings', queryParameters: filters);
      final data = (response.data as List)
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(listings: data, isLoading: false);
      // Cache for offline access
      await _storage.cacheListings(
        data.map((l) => l.toJson()).toList(),
      );
    } catch (e) {
      // Fall back to cached data
      final cached = _storage.getCachedListings();
      final cachedListings = cached.map((e) => Listing.fromJson(e)).toList();
      state = state.copyWith(
        listings: cachedListings,
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}

final listingsProvider =
    StateNotifierProvider<ListingsNotifier, ListingsState>((ref) {
  return ListingsNotifier(
    ref.watch(apiClientProvider),
    ref.watch(cacheServiceProvider),
  );
});
