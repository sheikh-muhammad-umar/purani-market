import 'package:json_annotation/json_annotation.dart';

part 'review.g.dart';

enum ReviewStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('approved')
  approved,
  @JsonValue('rejected')
  rejected,
}

@JsonSerializable()
class Review {
  @JsonKey(name: '_id')
  final String id;
  final String reviewerId;
  final String sellerId;
  final String productListingId;
  final int rating; // 1-5
  final String text;
  final ReviewStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Review({
    required this.id,
    required this.reviewerId,
    required this.sellerId,
    required this.productListingId,
    required this.rating,
    required this.text,
    this.status = ReviewStatus.pending,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) =>
      _$ReviewFromJson(json);
  Map<String, dynamic> toJson() => _$ReviewToJson(this);
}
