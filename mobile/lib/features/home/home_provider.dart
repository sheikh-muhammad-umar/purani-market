import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/category.dart';
import '../../models/listing.dart';

/// State for the home screen data.
class HomeState {
  final List<Category> categories;
  final List<Listing> featuredAds;
  final List<Listing> recommendations;
  final bool isLoading;
  final String? error;

  const HomeState({
    this.categories = const [],
    this.featuredAds = const [],
    this.recommendations = const [],
    this.isLoading = false,
    this.error,
  });

  HomeState copyWith({
    List<Category>? categories,
    List<Listing>? featuredAds,
    List<Listing>? recommendations,
    bool? isLoading,
    String? error,
  }) {
    return HomeState(
      categories: categories ?? this.categories,
      featuredAds: featuredAds ?? this.featuredAds,
      recommendations: recommendations ?? this.recommendations,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class HomeNotifier extends StateNotifier<HomeState> {
  final ApiClient _api;

  HomeNotifier({required ApiClient api})
      : _api = api,
        super(const HomeState());

  Future<void> loadHomeData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final results = await Future.wait([
        _api.get('/categories'),
        _api.get('/search', queryParameters: {'featured': 'true', 'limit': '10'}),
        _api.get('/recommendations'),
      ]);

      final categories = (results[0].data as List)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
      final featured = (results[1].data['results'] as List? ?? [])
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();
      final recs = (results[2].data as List? ?? [])
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();

      state = HomeState(
        categories: categories,
        featuredAds: featured,
        recommendations: recs,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() => loadHomeData();
}

final homeProvider = StateNotifierProvider<HomeNotifier, HomeState>((ref) {
  return HomeNotifier(api: ref.watch(apiClientProvider));
});
