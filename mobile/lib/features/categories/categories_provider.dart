import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/category.dart';

/// State for category browsing with 3-level navigation.
class CategoriesState {
  final List<Category> rootCategories;
  final Category? selectedLevel1;
  final Category? selectedLevel2;
  final List<Category> level2Categories;
  final List<Category> level3Categories;
  final bool isLoading;
  final String? error;

  const CategoriesState({
    this.rootCategories = const [],
    this.selectedLevel1,
    this.selectedLevel2,
    this.level2Categories = const [],
    this.level3Categories = const [],
    this.isLoading = false,
    this.error,
  });

  CategoriesState copyWith({
    List<Category>? rootCategories,
    Category? selectedLevel1,
    Category? selectedLevel2,
    List<Category>? level2Categories,
    List<Category>? level3Categories,
    bool? isLoading,
    String? error,
    bool clearLevel1 = false,
    bool clearLevel2 = false,
  }) {
    return CategoriesState(
      rootCategories: rootCategories ?? this.rootCategories,
      selectedLevel1: clearLevel1 ? null : (selectedLevel1 ?? this.selectedLevel1),
      selectedLevel2: clearLevel2 ? null : (selectedLevel2 ?? this.selectedLevel2),
      level2Categories: level2Categories ?? this.level2Categories,
      level3Categories: level3Categories ?? this.level3Categories,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class CategoriesNotifier extends StateNotifier<CategoriesState> {
  final ApiClient _api;

  CategoriesNotifier({required ApiClient api})
      : _api = api,
        super(const CategoriesState());

  Future<void> loadCategories() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/categories');
      final categories = (response.data as List)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
      state = CategoriesState(rootCategories: categories);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void selectLevel1(Category category) {
    state = state.copyWith(
      selectedLevel1: category,
      level2Categories: category.children ?? [],
      clearLevel2: true,
      level3Categories: [],
    );
  }

  void selectLevel2(Category category) {
    state = state.copyWith(
      selectedLevel2: category,
      level3Categories: category.children ?? [],
    );
  }

  void goBack() {
    if (state.selectedLevel2 != null) {
      state = state.copyWith(clearLevel2: true, level3Categories: []);
    } else if (state.selectedLevel1 != null) {
      state = state.copyWith(
        clearLevel1: true,
        level2Categories: [],
        level3Categories: [],
      );
    }
  }
}

final categoriesProvider =
    StateNotifierProvider<CategoriesNotifier, CategoriesState>((ref) {
  return CategoriesNotifier(api: ref.watch(apiClientProvider));
});
