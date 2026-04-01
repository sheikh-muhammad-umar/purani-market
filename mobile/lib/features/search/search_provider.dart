import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/category.dart';
import '../../models/listing.dart';

enum SortOption { relevance, newest, priceLowHigh, priceHighLow }

/// Active search filters.
class SearchFilters {
  final String? categoryId;
  final double? priceMin;
  final double? priceMax;
  final String? condition;
  final double? locationLat;
  final double? locationLng;
  final int? radiusKm;
  final SortOption sort;
  final Map<String, dynamic> categoryFilters;

  const SearchFilters({
    this.categoryId,
    this.priceMin,
    this.priceMax,
    this.condition,
    this.locationLat,
    this.locationLng,
    this.radiusKm,
    this.sort = SortOption.relevance,
    this.categoryFilters = const {},
  });

  SearchFilters copyWith({
    String? categoryId,
    double? priceMin,
    double? priceMax,
    String? condition,
    double? locationLat,
    double? locationLng,
    int? radiusKm,
    SortOption? sort,
    Map<String, dynamic>? categoryFilters,
    bool clearCategory = false,
    bool clearCondition = false,
    bool clearPrice = false,
  }) {
    return SearchFilters(
      categoryId: clearCategory ? null : (categoryId ?? this.categoryId),
      priceMin: clearPrice ? null : (priceMin ?? this.priceMin),
      priceMax: clearPrice ? null : (priceMax ?? this.priceMax),
      condition: clearCondition ? null : (condition ?? this.condition),
      locationLat: locationLat ?? this.locationLat,
      locationLng: locationLng ?? this.locationLng,
      radiusKm: radiusKm ?? this.radiusKm,
      sort: sort ?? this.sort,
      categoryFilters: categoryFilters ?? this.categoryFilters,
    );
  }

  Map<String, dynamic> toQueryParams() {
    final params = <String, dynamic>{};
    if (categoryId != null) params['categoryId'] = categoryId;
    if (priceMin != null) params['priceMin'] = priceMin.toString();
    if (priceMax != null) params['priceMax'] = priceMax.toString();
    if (condition != null) params['condition'] = condition;
    if (locationLat != null) params['lat'] = locationLat.toString();
    if (locationLng != null) params['lng'] = locationLng.toString();
    if (radiusKm != null) params['radius'] = radiusKm.toString();
    params['sort'] = sort.name;
    categoryFilters.forEach((key, value) {
      params['filter_$key'] = value.toString();
    });
    return params;
  }

  /// Returns a list of active filter labels for dismissible chips.
  List<MapEntry<String, String>> get activeFilterChips {
    final chips = <MapEntry<String, String>>[];
    if (condition != null) chips.add(MapEntry('condition', condition!));
    if (priceMin != null || priceMax != null) {
      final label = 'Rs ${priceMin?.toStringAsFixed(0) ?? '0'} - ${priceMax?.toStringAsFixed(0) ?? '∞'}';
      chips.add(MapEntry('price', label));
    }
    for (final entry in categoryFilters.entries) {
      chips.add(MapEntry('cf_${entry.key}', '${entry.key}: ${entry.value}'));
    }
    return chips;
  }
}

class SearchState {
  final String query;
  final SearchFilters filters;
  final List<Listing> results;
  final List<String> recentSearches;
  final List<String> trendingTerms;
  final List<String> aiSuggestions;
  final List<CategoryFilter> dynamicFilters;
  final bool isLoading;
  final bool hasSearched;
  final String? error;

  const SearchState({
    this.query = '',
    this.filters = const SearchFilters(),
    this.results = const [],
    this.recentSearches = const [],
    this.trendingTerms = const [],
    this.aiSuggestions = const [],
    this.dynamicFilters = const [],
    this.isLoading = false,
    this.hasSearched = false,
    this.error,
  });

  SearchState copyWith({
    String? query,
    SearchFilters? filters,
    List<Listing>? results,
    List<String>? recentSearches,
    List<String>? trendingTerms,
    List<String>? aiSuggestions,
    List<CategoryFilter>? dynamicFilters,
    bool? isLoading,
    bool? hasSearched,
    String? error,
  }) {
    return SearchState(
      query: query ?? this.query,
      filters: filters ?? this.filters,
      results: results ?? this.results,
      recentSearches: recentSearches ?? this.recentSearches,
      trendingTerms: trendingTerms ?? this.trendingTerms,
      aiSuggestions: aiSuggestions ?? this.aiSuggestions,
      dynamicFilters: dynamicFilters ?? this.dynamicFilters,
      isLoading: isLoading ?? this.isLoading,
      hasSearched: hasSearched ?? this.hasSearched,
      error: error,
    );
  }
}

class SearchNotifier extends StateNotifier<SearchState> {
  final ApiClient _api;

  SearchNotifier({required ApiClient api})
      : _api = api,
        super(const SearchState());

  Future<void> loadSuggestions() async {
    try {
      final response = await _api.get('/search/suggestions');
      final data = response.data as Map<String, dynamic>;
      state = state.copyWith(
        trendingTerms: List<String>.from(data['trending'] ?? []),
        aiSuggestions: List<String>.from(data['aiSuggestions'] ?? []),
        recentSearches: List<String>.from(data['recent'] ?? []),
      );
    } catch (_) {}
  }

  Future<void> search(String query) async {
    state = state.copyWith(query: query, isLoading: true, error: null);
    try {
      final params = state.filters.toQueryParams();
      if (query.isNotEmpty) params['q'] = query;

      final response = await _api.get('/search', queryParameters: params);
      final data = response.data as Map<String, dynamic>;
      final results = (data['results'] as List? ?? [])
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();

      state = state.copyWith(
        results: results,
        isLoading: false,
        hasSearched: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString(), hasSearched: true);
    }
  }

  void updateFilters(SearchFilters filters) {
    state = state.copyWith(filters: filters);
  }

  void removeFilter(String key) {
    var filters = state.filters;
    if (key == 'condition') {
      filters = filters.copyWith(clearCondition: true);
    } else if (key == 'price') {
      filters = filters.copyWith(clearPrice: true);
    } else if (key.startsWith('cf_')) {
      final cfKey = key.substring(3);
      final newCf = Map<String, dynamic>.from(filters.categoryFilters)..remove(cfKey);
      filters = filters.copyWith(categoryFilters: newCf);
    }
    state = state.copyWith(filters: filters);
    search(state.query);
  }

  void setSort(SortOption sort) {
    state = state.copyWith(filters: state.filters.copyWith(sort: sort));
    search(state.query);
  }

  Future<void> loadDynamicFilters(String categoryId) async {
    try {
      final response = await _api.get('/categories/$categoryId');
      final category = Category.fromJson(response.data as Map<String, dynamic>);
      state = state.copyWith(dynamicFilters: category.filters);
    } catch (_) {}
  }
}

final searchProvider = StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(api: ref.watch(apiClientProvider));
});
