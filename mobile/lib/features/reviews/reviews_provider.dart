import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/review.dart';

/// State for reviews display.
class ReviewsState {
  final List<Review> reviews;
  final double averageRating;
  final bool isLoading;
  final String? error;

  const ReviewsState({
    this.reviews = const [],
    this.averageRating = 0,
    this.isLoading = false,
    this.error,
  });

  ReviewsState copyWith({
    List<Review>? reviews,
    double? averageRating,
    bool? isLoading,
    String? error,
  }) {
    return ReviewsState(
      reviews: reviews ?? this.reviews,
      averageRating: averageRating ?? this.averageRating,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ReviewsNotifier extends StateNotifier<ReviewsState> {
  final ApiClient _api;

  ReviewsNotifier({required ApiClient api})
      : _api = api,
        super(const ReviewsState());

  Future<void> loadReviewsForSeller(String sellerId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/reviews/seller/$sellerId');
      final data = response.data as Map<String, dynamic>;
      final reviews = (data['reviews'] as List)
          .map((e) => Review.fromJson(e as Map<String, dynamic>))
          .toList();
      final avg = (data['averageRating'] as num?)?.toDouble() ?? 0;
      state = ReviewsState(reviews: reviews, averageRating: avg);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadReviewsForListing(String listingId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/reviews/listing/$listingId');
      final data = response.data as Map<String, dynamic>;
      final reviews = (data['reviews'] as List)
          .map((e) => Review.fromJson(e as Map<String, dynamic>))
          .toList();
      final avg = (data['averageRating'] as num?)?.toDouble() ?? 0;
      state = ReviewsState(reviews: reviews, averageRating: avg);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final reviewsProvider =
    StateNotifierProvider<ReviewsNotifier, ReviewsState>((ref) {
  return ReviewsNotifier(api: ref.watch(apiClientProvider));
});

/// State for review submission.
class WriteReviewState {
  final int rating;
  final String text;
  final bool isSubmitting;
  final bool isSuccess;
  final String? error;

  const WriteReviewState({
    this.rating = 0,
    this.text = '',
    this.isSubmitting = false,
    this.isSuccess = false,
    this.error,
  });

  WriteReviewState copyWith({
    int? rating,
    String? text,
    bool? isSubmitting,
    bool? isSuccess,
    String? error,
  }) {
    return WriteReviewState(
      rating: rating ?? this.rating,
      text: text ?? this.text,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSuccess: isSuccess ?? this.isSuccess,
      error: error,
    );
  }
}

class WriteReviewNotifier extends StateNotifier<WriteReviewState> {
  final ApiClient _api;

  WriteReviewNotifier({required ApiClient api})
      : _api = api,
        super(const WriteReviewState());

  void setRating(int rating) => state = state.copyWith(rating: rating);
  void setText(String text) => state = state.copyWith(text: text);

  Future<void> submit({
    required String sellerId,
    required String productListingId,
  }) async {
    if (state.rating == 0) {
      state = state.copyWith(error: 'Please select a rating');
      return;
    }
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      await _api.post('/reviews', data: {
        'sellerId': sellerId,
        'productListingId': productListingId,
        'rating': state.rating,
        'text': state.text,
      });
      state = state.copyWith(isSubmitting: false, isSuccess: true);
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
    }
  }
}

final writeReviewProvider =
    StateNotifierProvider<WriteReviewNotifier, WriteReviewState>((ref) {
  return WriteReviewNotifier(api: ref.watch(apiClientProvider));
});
