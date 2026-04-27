import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/listings/available_packages_widget.dart';
import 'package:marketplace_mobile/features/packages/packages_provider.dart';
import 'package:marketplace_mobile/models/ad_package.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))),
  );
}

PackagePurchase _makePurchase({
  String id = 'purchase1',
  PackageType type = PackageType.featuredAds,
  int remainingQuantity = 3,
  int quantity = 5,
  DateTime? expiresAt,
}) {
  return PackagePurchase(
    id: id,
    sellerId: 'seller1',
    packageId: 'pkg1',
    categoryId: 'cat1',
    type: type,
    quantity: quantity,
    remainingQuantity: remainingQuantity,
    duration: 30,
    price: 1000,
    paymentMethod: PaymentMethod.jazzcash,
    paymentStatus: PaymentStatus.completed,
    paymentTransactionId: 'txn1',
    expiresAt: expiresAt ?? DateTime.now().add(const Duration(days: 15)),
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );
}

void main() {
  group('AvailablePackagesWidget', () {
    testWidgets('shows loading indicator when packages are loading',
        (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              const PackagesState(isLoading: true),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Apply Package'), findsOneWidget);
    });

    testWidgets('shows empty state when no packages available',
        (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              const PackagesState(isLoading: false, availablePackages: []),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(
        find.text('No packages available for this category'),
        findsOneWidget,
      );
      expect(find.text('Purchase Packages'), findsOneWidget);
    });

    testWidgets('shows error state with retry button', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              const PackagesState(
                isLoading: false,
                error: 'Network error',
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Failed to load packages.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('displays package cards when packages are available',
        (tester) async {
      final packages = [
        _makePurchase(id: 'p1', type: PackageType.featuredAds),
        _makePurchase(
          id: 'p2',
          type: PackageType.adSlots,
          remainingQuantity: 1,
          quantity: 10,
        ),
      ];

      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              PackagesState(
                isLoading: false,
                availablePackages: packages,
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Featured Ads'), findsOneWidget);
      expect(find.text('Ad Slots'), findsOneWidget);
      expect(find.text('2 packages available'), findsOneWidget);
    });

    testWidgets('selecting a package calls onPackageSelected callback',
        (tester) async {
      String? selectedId;
      final packages = [
        _makePurchase(id: 'p1', type: PackageType.featuredAds),
      ];

      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (id) => selectedId = id,
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              PackagesState(
                isLoading: false,
                availablePackages: packages,
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      // Tap the package card
      await tester.tap(find.text('Featured Ads'));
      await tester.pump();

      expect(selectedId, 'p1');
    });

    testWidgets('deselecting a package emits null', (tester) async {
      String? selectedId = 'initial';
      final packages = [
        _makePurchase(id: 'p1', type: PackageType.featuredAds),
      ];

      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (id) => selectedId = id,
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              PackagesState(
                isLoading: false,
                availablePackages: packages,
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      // Select
      await tester.tap(find.text('Featured Ads'));
      await tester.pump();
      expect(selectedId, 'p1');

      // Deselect by tapping again
      await tester.tap(find.text('Featured Ads'));
      await tester.pump();
      expect(selectedId, isNull);
    });

    testWidgets('shows remaining quantity and total quantity',
        (tester) async {
      final packages = [
        _makePurchase(
          id: 'p1',
          remainingQuantity: 3,
          quantity: 5,
        ),
      ];

      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              PackagesState(
                isLoading: false,
                availablePackages: packages,
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.textContaining('3/5 remaining'), findsOneWidget);
    });

    testWidgets('shows singular text for 1 package', (tester) async {
      final packages = [_makePurchase(id: 'p1')];

      await tester.pumpWidget(createTestWidget(
        child: AvailablePackagesWidget(
          categoryId: 'cat1',
          onPackageSelected: (_) {},
        ),
        overrides: [
          packagesProvider.overrideWith((ref) {
            return _FakePackagesNotifier(
              PackagesState(
                isLoading: false,
                availablePackages: packages,
              ),
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('1 package available'), findsOneWidget);
    });
  });
}

/// Fake notifier that returns a fixed state without making API calls.
class _FakePackagesNotifier extends PackagesNotifier {
  final PackagesState _initialState;

  _FakePackagesNotifier(this._initialState)
      : super(api: throw UnimplementedError()) {
    state = _initialState;
  }

  @override
  Future<void> loadAvailablePackages(String categoryId) async {
    // No-op in tests
  }

  @override
  Future<void> loadPackages() async {}

  @override
  Future<void> loadMyPurchases({String? categoryId}) async {}
}
