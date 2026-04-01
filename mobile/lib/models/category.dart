import 'package:json_annotation/json_annotation.dart';

part 'category.g.dart';

enum CategoryAttributeType {
  @JsonValue('text')
  text,
  @JsonValue('number')
  number,
  @JsonValue('select')
  select,
  @JsonValue('multiselect')
  multiselect,
  @JsonValue('boolean')
  boolean,
}

enum CategoryFilterType {
  @JsonValue('range')
  range,
  @JsonValue('select')
  select,
  @JsonValue('multiselect')
  multiselect,
  @JsonValue('boolean')
  boolean,
}

@JsonSerializable()
class CategoryAttribute {
  final String name;
  final String key;
  final CategoryAttributeType type;
  final List<String>? options;
  final bool required;
  final String? unit;

  const CategoryAttribute({
    required this.name,
    required this.key,
    required this.type,
    this.options,
    this.required = false,
    this.unit,
  });

  factory CategoryAttribute.fromJson(Map<String, dynamic> json) =>
      _$CategoryAttributeFromJson(json);
  Map<String, dynamic> toJson() => _$CategoryAttributeToJson(this);
}

@JsonSerializable()
class CategoryFilter {
  final String name;
  final String key;
  final CategoryFilterType type;
  final List<String>? options;
  final double? rangeMin;
  final double? rangeMax;

  const CategoryFilter({
    required this.name,
    required this.key,
    required this.type,
    this.options,
    this.rangeMin,
    this.rangeMax,
  });

  factory CategoryFilter.fromJson(Map<String, dynamic> json) =>
      _$CategoryFilterFromJson(json);
  Map<String, dynamic> toJson() => _$CategoryFilterToJson(this);
}

@JsonSerializable()
class Category {
  @JsonKey(name: '_id')
  final String id;
  final String name;
  final String slug;
  final String? parentId;
  final int level;
  final List<CategoryAttribute> attributes;
  final List<CategoryFilter> filters;
  final bool isActive;
  final int sortOrder;
  final List<Category>? children;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Category({
    required this.id,
    required this.name,
    required this.slug,
    this.parentId,
    required this.level,
    this.attributes = const [],
    this.filters = const [],
    this.isActive = true,
    this.sortOrder = 0,
    this.children,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);
  Map<String, dynamic> toJson() => _$CategoryToJson(this);
}
