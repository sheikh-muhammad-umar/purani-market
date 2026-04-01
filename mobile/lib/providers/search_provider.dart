import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../models/listing.dart';

class SearchState {
  final List<Listing> results;
  final List<String> suggestions;
  final bool isLoading;
  final String? error;

  const SearchState({
    this.results = const [],
    this.suggestions = const [],
    this.isLoading = false,
    this.error,
  });

  SearchState copyWith({
    List<Listing>? results,
    List<String>? suggestions,
    bool? isLoading,
    String? error,
  }) {
    return SearchState(
      results: results ?? this.results,
      suggestions: suggestions ?? this.suggestions,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class SearchNotifier extends StateNotifier<SearchState> {
  final ApiClient _api;

  SearchNotifier(this._api) : super(const SearchState());

  Future<void> search(String query, {Map<String, dynamic>? filters}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final params = <String, dynamic>{'q': query, ...?filters};
      final response = await _api.get('/search', queryParameters: params);
      final data = (response.data as List)
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(results: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchSuggestions(String query) async {
    try {
      final response = await _api.get(
        '/search/suggestions',
        queryParameters: {'q': query},
      );
      final data = (response.data as List).cast<String>();
      state = state.copyWith(suggestions: data);
    } catch (_) {
      // Silently fail for suggestions
    }
  }
}

final searchProvider =
    StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(ref.watch(apiClientProvider));
});
