import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../models/favorite.dart';

class FavoritesState {
  final List<Favorite> favorites;
  final bool isLoading;
  final String? error;

  const FavoritesState({
    this.favorites = const [],
    this.isLoading = false,
    this.error,
  });

  FavoritesState copyWith({
    List<Favorite>? favorites,
    bool? isLoading,
    String? error,
  }) {
    return FavoritesState(
      favorites: favorites ?? this.favorites,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class FavoritesNotifier extends StateNotifier<FavoritesState> {
  final ApiClient _api;

  FavoritesNotifier(this._api) : super(const FavoritesState());

  Future<void> fetchFavorites() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/favorites');
      final data = (response.data as List)
          .map((e) => Favorite.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(favorites: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> addFavorite(String listingId) async {
    try {
      await _api.post('/favorites', data: {'productListingId': listingId});
      await fetchFavorites();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> removeFavorite(String favoriteId) async {
    try {
      await _api.delete('/favorites/$favoriteId');
      await fetchFavorites();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

final favoritesProvider =
    StateNotifierProvider<FavoritesNotifier, FavoritesState>((ref) {
  return FavoritesNotifier(ref.watch(apiClientProvider));
});
