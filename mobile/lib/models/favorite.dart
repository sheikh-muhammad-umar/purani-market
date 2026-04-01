import 'package:json_annotation/json_annotation.dart';

part 'favorite.g.dart';

@JsonSerializable()
class Favorite {
  @JsonKey(name: '_id')
  final String id;
  final String userId;
  final String productListingId;
  final DateTime createdAt;

  const Favorite({
    required this.id,
    required this.userId,
    required this.productListingId,
    required this.createdAt,
  });

  factory Favorite.fromJson(Map<String, dynamic> json) =>
      _$FavoriteFromJson(json);
  Map<String, dynamic> toJson() => _$FavoriteToJson(this);
}
