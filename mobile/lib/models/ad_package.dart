import 'package:json_annotation/json_annotation.dart';

part 'ad_package.g.dart';

enum PackageType {
  @JsonValue('featured_ads')
  featuredAds,
  @JsonValue('ad_slots')
  adSlots,
}

enum PaymentMethod {
  @JsonValue('jazzcash')
  jazzcash,
  @JsonValue('easypaisa')
  easypaisa,
  @JsonValue('card')
  card,
}

enum PaymentStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('completed')
  completed,
  @JsonValue('failed')
  failed,
  @JsonValue('refunded')
  refunded,
}

@JsonSerializable()
class CategoryPricing {
  final String categoryId;
  final double price;

  const CategoryPricing({required this.categoryId, required this.price});

  factory CategoryPricing.fromJson(Map<String, dynamic> json) =>
      _$CategoryPricingFromJson(json);
  Map<String, dynamic> toJson() => _$CategoryPricingToJson(this);
}

@JsonSerializable()
class AdPackage {
  @JsonKey(name: '_id')
  final String id;
  final String name;
  final PackageType type;
  final int duration; // 7, 15, or 30
  final int quantity;
  final double defaultPrice;
  final List<CategoryPricing> categoryPricing;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  const AdPackage({
    required this.id,
    required this.name,
    required this.type,
    required this.duration,
    required this.quantity,
    required this.defaultPrice,
    this.categoryPricing = const [],
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AdPackage.fromJson(Map<String, dynamic> json) =>
      _$AdPackageFromJson(json);
  Map<String, dynamic> toJson() => _$AdPackageToJson(this);
}

@JsonSerializable()
class PackagePurchase {
  @JsonKey(name: '_id')
  final String id;
  final String sellerId;
  final String packageId;
  final String? categoryId;
  final PackageType type;
  final int quantity;
  final int remainingQuantity;
  final int duration;
  final double price;
  final PaymentMethod paymentMethod;
  final PaymentStatus paymentStatus;
  final String paymentTransactionId;
  final DateTime? activatedAt;
  final DateTime? expiresAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const PackagePurchase({
    required this.id,
    required this.sellerId,
    required this.packageId,
    this.categoryId,
    required this.type,
    required this.quantity,
    required this.remainingQuantity,
    required this.duration,
    required this.price,
    required this.paymentMethod,
    this.paymentStatus = PaymentStatus.pending,
    required this.paymentTransactionId,
    this.activatedAt,
    this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PackagePurchase.fromJson(Map<String, dynamic> json) =>
      _$PackagePurchaseFromJson(json);
  Map<String, dynamic> toJson() => _$PackagePurchaseToJson(this);
}
