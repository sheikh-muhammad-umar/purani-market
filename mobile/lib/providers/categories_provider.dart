import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../core/storage/cache_service.dart';
import '../models/category.dart';

class CategoriesState {
  final List<Category> categories;
  final bool isLoading;
  final String? error;

  const CategoriesState({
    this.categories = const [],
    this.isLoading = false,
    this.error,
  });

  CategoriesState copyWith({
    List<Category>? categories,
    bool? isLoading,
    String? error,
  }) {
    return CategoriesState(
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class CategoriesNotifier extends StateNotifier<CategoriesState> {
  final ApiClient _api;
  final CacheService _storage;

  CategoriesNotifier(this._api, this._storage)
      : super(const CategoriesState());

  Future<void> fetchCategories() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/categories');
      final data = (response.data as List)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(categories: data, isLoading: false);
      await _storage.cacheCategories(data.map((c) => c.toJson()).toList());
    } catch (e) {
      final cached = _storage.getCachedCategories();
      final cachedCategories =
          cached.map((e) => Category.fromJson(e)).toList();
      state = state.copyWith(
        categories: cachedCategories,
        isLoading: false,
        error: e.toString(),
      );
    }
  }
}

final categoriesProvider =
    StateNotifierProvider<CategoriesNotifier, CategoriesState>((ref) {
  return CategoriesNotifier(
    ref.watch(apiClientProvider),
    ref.watch(cacheServiceProvider),
  );
});
