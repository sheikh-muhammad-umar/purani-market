import 'package:json_annotation/json_annotation.dart';

part 'conversation.g.dart';

@JsonSerializable()
class Conversation {
  @JsonKey(name: '_id')
  final String id;
  final String productListingId;
  final String buyerId;
  final String sellerId;
  final DateTime lastMessageAt;
  final String lastMessagePreview;
  final DateTime createdAt;

  const Conversation({
    required this.id,
    required this.productListingId,
    required this.buyerId,
    required this.sellerId,
    required this.lastMessageAt,
    required this.lastMessagePreview,
    required this.createdAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) =>
      _$ConversationFromJson(json);
  Map<String, dynamic> toJson() => _$ConversationToJson(this);
}
