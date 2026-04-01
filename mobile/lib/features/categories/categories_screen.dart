import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/category.dart';
import 'categories_provider.dart';

/// Category browse screen with 3-level navigation.
class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});

  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(categoriesProvider.notifier).loadCategories());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(categoriesProvider);
    final notifier = ref.read(categoriesProvider.notifier);

    final String title;
    if (state.selectedLevel2 != null) {
      title = state.selectedLevel2!.name;
    } else if (state.selectedLevel1 != null) {
      title = state.selectedLevel1!.name;
    } else {
      title = 'Categories';
    }

    final showBack = state.selectedLevel1 != null;

    return Scaffold(
      appBar: AppBar(
        leading: showBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: notifier.goBack,
              )
            : null,
        title: Text(title),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _buildCategoryList(state, notifier),
    );
  }

  Widget _buildCategoryList(CategoriesState state, CategoriesNotifier notifier) {
    final List<Category> categories;
    final int currentLevel;

    if (state.selectedLevel2 != null) {
      categories = state.level3Categories;
      currentLevel = 3;
    } else if (state.selectedLevel1 != null) {
      categories = state.level2Categories;
      currentLevel = 2;
    } else {
      categories = state.rootCategories;
      currentLevel = 1;
    }

    if (categories.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.category_outlined, size: 64, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.s2),
            Text(
              currentLevel > 1 ? 'No subcategories' : 'No categories available',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.s2),
      itemCount: categories.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.s1),
      itemBuilder: (context, index) {
        final cat = categories[index];
        final hasChildren = (cat.children?.isNotEmpty ?? false);

        return Material(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            onTap: () {
              if (currentLevel == 1) {
                notifier.selectLevel1(cat);
              } else if (currentLevel == 2 && hasChildren) {
                notifier.selectLevel2(cat);
              } else {
                // Navigate to search with category filter
                context.push('/search?categoryId=${cat.id}');
              }
            },
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.s2),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                    child: Icon(
                      _categoryIcon(cat.name),
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s2),
                  Expanded(
                    child: Text(
                      cat.name,
                      style: const TextStyle(
                        fontSize: AppTypography.textBase,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (hasChildren || currentLevel < 3)
                    const Icon(
                      Icons.chevron_right,
                      color: AppColors.textMuted,
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

IconData _categoryIcon(String name) {
  final lower = name.toLowerCase();
  if (lower.contains('car') || lower.contains('vehicle')) return Icons.directions_car;
  if (lower.contains('phone') || lower.contains('mobile')) return Icons.phone_android;
  if (lower.contains('property') || lower.contains('house')) return Icons.home;
  if (lower.contains('fashion') || lower.contains('cloth')) return Icons.checkroom;
  if (lower.contains('electronic')) return Icons.devices;
  if (lower.contains('furniture')) return Icons.chair;
  if (lower.contains('sport')) return Icons.sports_soccer;
  if (lower.contains('book')) return Icons.menu_book;
  if (lower.contains('pet') || lower.contains('animal')) return Icons.pets;
  if (lower.contains('job')) return Icons.work;
  return Icons.category;
}
