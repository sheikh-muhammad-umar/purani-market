import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/ad_package.dart';

/// State for available packages list.
class PackagesState {
  final List<AdPackage> packages;
  final List<PackagePurchase> myPurchases;
  final bool isLoading;
  final String? error;

  const PackagesState({
    this.packages = const [],
    this.myPurchases = const [],
    this.isLoading = false,
    this.error,
  });

  PackagesState copyWith({
    List<AdPackage>? packages,
    List<PackagePurchase>? myPurchases,
    bool? isLoading,
    String? error,
  }) {
    return PackagesState(
      packages: packages ?? this.packages,
      myPurchases: myPurchases ?? this.myPurchases,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class PackagesNotifier extends StateNotifier<PackagesState> {
  final ApiClient _api;

  PackagesNotifier({required ApiClient api})
      : _api = api,
        super(const PackagesState());

  Future<void> loadPackages() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/packages');
      final list = (response.data as List)
          .map((e) => AdPackage.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(packages: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMyPurchases() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/packages/my-purchases');
      final list = (response.data as List)
          .map((e) => PackagePurchase.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(myPurchases: list, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final packagesProvider =
    StateNotifierProvider<PackagesNotifier, PackagesState>((ref) {
  return PackagesNotifier(api: ref.watch(apiClientProvider));
});

/// State for purchase flow.
class PurchaseFlowState {
  final String? selectedPackageId;
  final PaymentMethod? selectedPaymentMethod;
  final bool isPurchasing;
  final bool isSuccess;
  final String? error;

  const PurchaseFlowState({
    this.selectedPackageId,
    this.selectedPaymentMethod,
    this.isPurchasing = false,
    this.isSuccess = false,
    this.error,
  });

  PurchaseFlowState copyWith({
    String? selectedPackageId,
    PaymentMethod? selectedPaymentMethod,
    bool? isPurchasing,
    bool? isSuccess,
    String? error,
  }) {
    return PurchaseFlowState(
      selectedPackageId: selectedPackageId ?? this.selectedPackageId,
      selectedPaymentMethod:
          selectedPaymentMethod ?? this.selectedPaymentMethod,
      isPurchasing: isPurchasing ?? this.isPurchasing,
      isSuccess: isSuccess ?? this.isSuccess,
      error: error,
    );
  }
}

class PurchaseFlowNotifier extends StateNotifier<PurchaseFlowState> {
  final ApiClient _api;

  PurchaseFlowNotifier({required ApiClient api})
      : _api = api,
        super(const PurchaseFlowState());

  void selectPackage(String packageId) =>
      state = state.copyWith(selectedPackageId: packageId);

  void selectPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(selectedPaymentMethod: method);

  Future<void> purchase() async {
    if (state.selectedPackageId == null ||
        state.selectedPaymentMethod == null) {
      state = state.copyWith(
          error: 'Please select a package and payment method');
      return;
    }
    state = state.copyWith(isPurchasing: true, error: null);
    try {
      await _api.post('/packages/purchase', data: {
        'packageId': state.selectedPackageId,
        'paymentMethod': state.selectedPaymentMethod!.name,
      });
      state = state.copyWith(isPurchasing: false, isSuccess: true);
    } catch (e) {
      state = state.copyWith(isPurchasing: false, error: e.toString());
    }
  }

  void reset() => state = const PurchaseFlowState();
}

final purchaseFlowProvider =
    StateNotifierProvider<PurchaseFlowNotifier, PurchaseFlowState>((ref) {
  return PurchaseFlowNotifier(api: ref.watch(apiClientProvider));
});
