import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/listing.dart';

class SellerDashboardState {
  final List<Listing> listings;
  final int totalViews;
  final int totalFavorites;
  final int totalMessages;
  final int freeAdLimit;
  final int activeAdCount;
  final int paidAdSlots;
  final int featuredAdsActive;
  final int featuredAdsTotal;
  final bool isLoading;
  final String? error;

  const SellerDashboardState({
    this.listings = const [],
    this.totalViews = 0,
    this.totalFavorites = 0,
    this.totalMessages = 0,
    this.freeAdLimit = 10,
    this.activeAdCount = 0,
    this.paidAdSlots = 0,
    this.featuredAdsActive = 0,
    this.featuredAdsTotal = 0,
    this.isLoading = false,
    this.error,
  });

  SellerDashboardState copyWith({
    List<Listing>? listings,
    int? totalViews,
    int? totalFavorites,
    int? totalMessages,
    int? freeAdLimit,
    int? activeAdCount,
    int? paidAdSlots,
    int? featuredAdsActive,
    int? featuredAdsTotal,
    bool? isLoading,
    String? error,
  }) {
    return SellerDashboardState(
      listings: listings ?? this.listings,
      totalViews: totalViews ?? this.totalViews,
      totalFavorites: totalFavorites ?? this.totalFavorites,
      totalMessages: totalMessages ?? this.totalMessages,
      freeAdLimit: freeAdLimit ?? this.freeAdLimit,
      activeAdCount: activeAdCount ?? this.activeAdCount,
      paidAdSlots: paidAdSlots ?? this.paidAdSlots,
      featuredAdsActive: featuredAdsActive ?? this.featuredAdsActive,
      featuredAdsTotal: featuredAdsTotal ?? this.featuredAdsTotal,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  int get totalSlots => freeAdLimit + paidAdSlots;
}

class SellerDashboardNotifier extends StateNotifier<SellerDashboardState> {
  final ApiClient _api;

  SellerDashboardNotifier({required ApiClient api})
      : _api = api,
        super(const SellerDashboardState());

  Future<void> loadDashboard() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/listings', queryParameters: {
        'mine': 'true',
      });
      final data = response.data;
      final listings = (data['results'] as List? ?? [])
          .map((e) => Listing.fromJson(e as Map<String, dynamic>))
          .toList();

      int views = 0, favs = 0;
      for (final l in listings) {
        views += l.viewCount;
        favs += l.favoriteCount;
      }

      state = SellerDashboardState(
        listings: listings,
        totalViews: views,
        totalFavorites: favs,
        activeAdCount: listings.where((l) => l.status == ListingStatus.active).length,
        featuredAdsActive: listings.where((l) => l.isFeatured).length,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> markAsSold(String listingId) async {
    try {
      await _api.patch('/listings/$listingId/status', data: {'status': 'sold'});
      await loadDashboard();
    } catch (_) {}
  }

  Future<void> markAsReserved(String listingId) async {
    try {
      await _api.patch('/listings/$listingId/status', data: {'status': 'reserved'});
      await loadDashboard();
    } catch (_) {}
  }

  Future<void> deleteListing(String listingId) async {
    try {
      await _api.delete('/listings/$listingId');
      await loadDashboard();
    } catch (_) {}
  }

  Future<void> deactivateListing(String listingId) async {
    try {
      await _api.patch('/listings/$listingId/status',
          data: {'status': 'inactive'});
      await loadDashboard();
    } catch (_) {}
  }

  Future<void> featureListing(String listingId) async {
    try {
      await _api.post('/listings/$listingId/feature');
      await loadDashboard();
    } catch (_) {}
  }
}

final sellerDashboardProvider =
    StateNotifierProvider<SellerDashboardNotifier, SellerDashboardState>((ref) {
  return SellerDashboardNotifier(api: ref.watch(apiClientProvider));
});
