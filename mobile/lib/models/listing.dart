import 'package:json_annotation/json_annotation.dart';

part 'listing.g.dart';

enum ListingCondition {
  @JsonValue('new')
  newCondition,
  @JsonValue('used')
  used,
  @JsonValue('refurbished')
  refurbished,
}

enum ListingStatus {
  @JsonValue('active')
  active,
  @JsonValue('pending_review')
  pendingReview,
  @JsonValue('rejected')
  rejected,
  @JsonValue('sold')
  sold,
  @JsonValue('reserved')
  reserved,
  @JsonValue('deleted')
  deleted,
}

@JsonSerializable()
class ListingPrice {
  final double amount;
  final String currency;

  const ListingPrice({required this.amount, this.currency = 'PKR'});

  factory ListingPrice.fromJson(Map<String, dynamic> json) =>
      _$ListingPriceFromJson(json);
  Map<String, dynamic> toJson() => _$ListingPriceToJson(this);
}

@JsonSerializable()
class ListingImage {
  final String url;
  final String thumbnailUrl;
  final int sortOrder;

  const ListingImage({
    required this.url,
    required this.thumbnailUrl,
    required this.sortOrder,
  });

  factory ListingImage.fromJson(Map<String, dynamic> json) =>
      _$ListingImageFromJson(json);
  Map<String, dynamic> toJson() => _$ListingImageToJson(this);
}

@JsonSerializable()
class ListingVideo {
  final String url;
  final String thumbnailUrl;

  const ListingVideo({required this.url, required this.thumbnailUrl});

  factory ListingVideo.fromJson(Map<String, dynamic> json) =>
      _$ListingVideoFromJson(json);
  Map<String, dynamic> toJson() => _$ListingVideoToJson(this);
}

@JsonSerializable()
class ListingLocation {
  final String type;
  final List<double> coordinates; // [lng, lat]
  final String city;
  final String area;

  const ListingLocation({
    this.type = 'Point',
    required this.coordinates,
    required this.city,
    required this.area,
  });

  factory ListingLocation.fromJson(Map<String, dynamic> json) =>
      _$ListingLocationFromJson(json);
  Map<String, dynamic> toJson() => _$ListingLocationToJson(this);
}

@JsonSerializable()
class ListingContactInfo {
  final String phone;
  final String email;

  const ListingContactInfo({required this.phone, required this.email});

  factory ListingContactInfo.fromJson(Map<String, dynamic> json) =>
      _$ListingContactInfoFromJson(json);
  Map<String, dynamic> toJson() => _$ListingContactInfoToJson(this);
}

@JsonSerializable()
class Listing {
  @JsonKey(name: '_id')
  final String id;
  final String sellerId;
  final String title;
  final String description;
  final ListingPrice price;
  final String categoryId;
  final List<String> categoryPath;
  final ListingCondition condition;
  final Map<String, dynamic> categoryAttributes;
  final List<ListingImage> images;
  final ListingVideo? video;
  final ListingLocation location;
  final ListingContactInfo contactInfo;
  final ListingStatus status;
  final bool isFeatured;
  final DateTime? featuredUntil;
  final String? rejectionReason;
  final int viewCount;
  final int favoriteCount;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Listing({
    required this.id,
    required this.sellerId,
    required this.title,
    required this.description,
    required this.price,
    required this.categoryId,
    this.categoryPath = const [],
    required this.condition,
    this.categoryAttributes = const {},
    this.images = const [],
    this.video,
    required this.location,
    required this.contactInfo,
    this.status = ListingStatus.active,
    this.isFeatured = false,
    this.featuredUntil,
    this.rejectionReason,
    this.viewCount = 0,
    this.favoriteCount = 0,
    this.deletedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Listing.fromJson(Map<String, dynamic> json) =>
      _$ListingFromJson(json);
  Map<String, dynamic> toJson() => _$ListingToJson(this);
}
