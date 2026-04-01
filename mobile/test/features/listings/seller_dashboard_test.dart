import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/listings/seller_dashboard_provider.dart';

void main() {
  group('SellerDashboardState', () {
    test('initial state has zero analytics', () {
      const state = SellerDashboardState();
      expect(state.listings, isEmpty);
      expect(state.totalViews, 0);
      expect(state.totalFavorites, 0);
      expect(state.totalMessages, 0);
      expect(state.freeAdLimit, 10);
      expect(state.activeAdCount, 0);
      expect(state.paidAdSlots, 0);
      expect(state.featuredAdsActive, 0);
      expect(state.featuredAdsTotal, 0);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('totalSlots is sum of freeAdLimit and paidAdSlots', () {
      const state = SellerDashboardState(
        freeAdLimit: 10,
        paidAdSlots: 5,
      );
      expect(state.totalSlots, 15);
    });

    test('totalSlots defaults to 10 (free limit only)', () {
      const state = SellerDashboardState();
      expect(state.totalSlots, 10);
    });

    test('copyWith updates analytics values', () {
      const state = SellerDashboardState();
      final updated = state.copyWith(
        totalViews: 150,
        totalFavorites: 25,
        totalMessages: 10,
      );
      expect(updated.totalViews, 150);
      expect(updated.totalFavorites, 25);
      expect(updated.totalMessages, 10);
    });

    test('copyWith updates ad slot values', () {
      const state = SellerDashboardState();
      final updated = state.copyWith(
        activeAdCount: 8,
        paidAdSlots: 20,
        featuredAdsActive: 3,
        featuredAdsTotal: 5,
      );
      expect(updated.activeAdCount, 8);
      expect(updated.paidAdSlots, 20);
      expect(updated.featuredAdsActive, 3);
      expect(updated.featuredAdsTotal, 5);
      expect(updated.totalSlots, 30); // 10 free + 20 paid
    });

    test('copyWith updates loading state', () {
      const state = SellerDashboardState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = SellerDashboardState();
      final withError = state.copyWith(error: 'Network error');
      expect(withError.error, 'Network error');
    });

    test('copyWith preserves existing values', () {
      const state = SellerDashboardState(
        totalViews: 100,
        freeAdLimit: 10,
      );
      final updated = state.copyWith(totalFavorites: 50);
      expect(updated.totalViews, 100);
      expect(updated.freeAdLimit, 10);
      expect(updated.totalFavorites, 50);
    });
  });
}
