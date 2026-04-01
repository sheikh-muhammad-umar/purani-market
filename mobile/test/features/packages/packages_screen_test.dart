import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/packages/packages_provider.dart';
import 'package:marketplace_mobile/features/packages/packages_screen.dart';
import 'package:marketplace_mobile/models/ad_package.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: child),
  );
}

void main() {
  group('PackagesScreen - UI', () {
    testWidgets('renders Ad Packages title in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const PackagesScreen(),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return PackagesNotifier(api: throw UnimplementedError());
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Ad Packages'), findsOneWidget);
    });

    testWidgets('renders Available and My Packages tabs', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const PackagesScreen(),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return PackagesNotifier(api: throw UnimplementedError());
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Available'), findsOneWidget);
      expect(find.text('My Packages'), findsOneWidget);
    });
  });

  group('PackagesState', () {
    test('initial state has empty packages and is not loading', () {
      const state = PackagesState();
      expect(state.packages, isEmpty);
      expect(state.myPurchases, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates loading state', () {
      const state = PackagesState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = PackagesState();
      final withError = state.copyWith(error: 'Failed');
      expect(withError.error, 'Failed');
    });
  });

  group('PurchaseFlowState', () {
    test('initial state has no selections', () {
      const state = PurchaseFlowState();
      expect(state.selectedPackageId, isNull);
      expect(state.selectedPaymentMethod, isNull);
      expect(state.isPurchasing, isFalse);
      expect(state.isSuccess, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates selected package', () {
      const state = PurchaseFlowState();
      final updated = state.copyWith(selectedPackageId: 'pkg-1');
      expect(updated.selectedPackageId, 'pkg-1');
    });

    test('copyWith updates payment method', () {
      const state = PurchaseFlowState();
      final updated =
          state.copyWith(selectedPaymentMethod: PaymentMethod.jazzcash);
      expect(updated.selectedPaymentMethod, PaymentMethod.jazzcash);
    });

    test('copyWith updates purchasing state', () {
      const state = PurchaseFlowState();
      final purchasing = state.copyWith(isPurchasing: true);
      expect(purchasing.isPurchasing, isTrue);
    });
  });

  group('AdPackage model', () {
    test('creates package from JSON', () {
      final json = {
        '_id': 'pkg-1',
        'name': 'Featured 10',
        'type': 'featured_ads',
        'duration': 30,
        'quantity': 10,
        'defaultPrice': 5000.0,
        'categoryPricing': [],
        'isActive': true,
        'createdAt': '2024-01-01T00:00:00.000Z',
        'updatedAt': '2024-01-01T00:00:00.000Z',
      };
      final pkg = AdPackage.fromJson(json);
      expect(pkg.id, 'pkg-1');
      expect(pkg.name, 'Featured 10');
      expect(pkg.type, PackageType.featuredAds);
      expect(pkg.duration, 30);
      expect(pkg.quantity, 10);
      expect(pkg.defaultPrice, 5000.0);
    });

    test('PackagePurchase tracks remaining quantity', () {
      final purchase = PackagePurchase(
        id: 'pur-1',
        sellerId: 'seller-1',
        packageId: 'pkg-1',
        type: PackageType.adSlots,
        quantity: 10,
        remainingQuantity: 7,
        duration: 30,
        price: 3000,
        paymentMethod: PaymentMethod.easypaisa,
        paymentStatus: PaymentStatus.completed,
        paymentTransactionId: 'txn-123',
        activatedAt: DateTime.now(),
        expiresAt: DateTime.now().add(const Duration(days: 30)),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(purchase.remainingQuantity, 7);
      expect(purchase.paymentStatus, PaymentStatus.completed);
    });
  });
}
