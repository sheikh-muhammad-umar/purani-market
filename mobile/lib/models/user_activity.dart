import 'package:json_annotation/json_annotation.dart';

part 'user_activity.g.dart';

enum UserActivityAction {
  @JsonValue('view')
  view,
  @JsonValue('search')
  search,
  @JsonValue('favorite')
  favorite,
  @JsonValue('dismiss')
  dismiss,
  @JsonValue('contact')
  contact,
}

@JsonSerializable()
class UserActivity {
  @JsonKey(name: '_id')
  final String id;
  final String userId;
  final UserActivityAction action;
  final String? productListingId;
  final String? searchQuery;
  final String? categoryId;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  const UserActivity({
    required this.id,
    required this.userId,
    required this.action,
    this.productListingId,
    this.searchQuery,
    this.categoryId,
    this.metadata,
    required this.createdAt,
  });

  factory UserActivity.fromJson(Map<String, dynamic> json) =>
      _$UserActivityFromJson(json);
  Map<String, dynamic> toJson() => _$UserActivityToJson(this);
}
