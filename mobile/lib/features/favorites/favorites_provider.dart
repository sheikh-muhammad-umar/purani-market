import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/favorite.dart';
import '../../models/listing.dart';

/// State for the favorites list.
class FavoritesState {
  final List<FavoriteWithListing> favorites;
  final bool isLoading;
  final String? error;

  const FavoritesState({
    this.favorites = const [],
    this.isLoading = false,
    this.error,
  });

  FavoritesState copyWith({
    List<FavoriteWithListing>? favorites,
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

/// A favorite entry paired with its listing data.
class FavoriteWithListing {
  final Favorite favorite;
  final Listing listing;

  const FavoriteWithListing({required this.favorite, required this.listing});
}

class FavoritesNotifier extends StateNotifier<FavoritesState> {
  final ApiClient _api;

  FavoritesNotifier({required ApiClient api})
      : _api = api,
        super(const FavoritesState());

  Future<void> loadFavorites() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/favorites');
      final list = (response.data as List).map((e) {
        final json = e as Map<String, dynamic>;
        return FavoriteWithListing(
          favorite: Favorite.fromJson(json['favorite'] as Map<String, dynamic>),
          listing: Listing.fromJson(json['listing'] as Map<String, dynamic>),
        );
      }).toList();
      state = FavoritesState(favorites: list);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> removeFavorite(String favoriteId) async {
    try {
      await _api.delete('/favorites/$favoriteId');
      state = state.copyWith(
        favorites:
            state.favorites.where((f) => f.favorite.id != favoriteId).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}

final favoritesProvider =
    StateNotifierProvider<FavoritesNotifier, FavoritesState>((ref) {
  return FavoritesNotifier(api: ref.watch(apiClientProvider));
});
