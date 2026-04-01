import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/category.dart';
import '../../models/listing.dart';
import '../../widgets/loading_shimmer.dart';
import 'home_provider.dart';

/// Category icon mapping by slug/name.
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

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(homeProvider.notifier).loadHomeData());
  }

  Future<void> _onRefresh() async {
    await ref.read(homeProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(homeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Marketplace',
          style: TextStyle(
            fontFamily: AppTypography.fontFamilyHeading,
            fontWeight: FontWeight.w700,
            color: AppColors.primary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: state.isLoading
          ? const _HomeShimmerLoading()
          : RefreshIndicator(
              onRefresh: _onRefresh,
              color: AppColors.primary,
              child: CustomScrollView(
                slivers: [
                  // Search bar
                  SliverToBoxAdapter(
                    child: GestureDetector(
                      onTap: () => context.push('/search'),
                      child: Container(
                        margin: const EdgeInsets.all(AppSpacing.s2),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.s2,
                          vertical: AppSpacing.s1 + 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.search, color: AppColors.textMuted),
                            const SizedBox(width: AppSpacing.s1),
                            Text(
                              'Search for anything...',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: AppTypography.textBase,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Category chips
                  if (state.categories.isNotEmpty)
                    SliverToBoxAdapter(
                      child: _CategoryChips(categories: state.categories),
                    ),

                  // Featured ads section
                  if (state.featuredAds.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: _SectionHeader(
                        icon: Icons.star,
                        iconColor: AppColors.accent,
                        title: 'Featured',
                        onSeeAll: () => context.push('/search?featured=true'),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: _FeaturedAdsSection(listings: state.featuredAds),
                    ),
                  ],

                  // For You recommendations grid
                  SliverToBoxAdapter(
                    child: _SectionHeader(
                      icon: Icons.recommend,
                      iconColor: AppColors.primary,
                      title: 'For You',
                      onSeeAll: () => context.push('/search'),
                    ),
                  ),
                  if (state.recommendations.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2),
                      sliver: SliverGrid(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: AppSpacing.s2,
                          crossAxisSpacing: AppSpacing.s2,
                          childAspectRatio: 0.72,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => _ListingCard(
                            listing: state.recommendations[index],
                          ),
                          childCount: state.recommendations.length,
                        ),
                      ),
                    )
                  else
                    const SliverToBoxAdapter(
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(AppSpacing.s4),
                          child: Text('No recommendations yet'),
                        ),
                      ),
                    ),

                  const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.s4)),
                ],
              ),
            ),
    );
  }
}

/// Horizontal scrollable category chips with icons.
class _CategoryChips extends StatelessWidget {
  final List<Category> categories;

  const _CategoryChips({required this.categories});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s1),
        itemBuilder: (context, index) {
          final cat = categories[index];
          return ActionChip(
            avatar: Icon(
              _categoryIcon(cat.name),
              size: 18,
              color: AppColors.primary,
            ),
            label: Text(cat.name),
            labelStyle: const TextStyle(
              fontSize: AppTypography.textSm,
              fontWeight: FontWeight.w500,
            ),
            backgroundColor: AppColors.surface,
            side: const BorderSide(color: AppColors.border),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            onPressed: () => context.push('/categories?id=${cat.id}'),
          );
        },
      ),
    );
  }
}

/// Section header with icon, title, and "See All" button.
class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final VoidCallback? onSeeAll;

  const _SectionHeader({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.s2, AppSpacing.s3, AppSpacing.s2, AppSpacing.s1,
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 22),
          const SizedBox(width: AppSpacing.s1),
          Text(
            title,
            style: const TextStyle(
              fontSize: AppTypography.textLg,
              fontWeight: FontWeight.w700,
              fontFamily: AppTypography.fontFamilyHeading,
            ),
          ),
          const Spacer(),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              child: const Text('See All'),
            ),
        ],
      ),
    );
  }
}

/// Featured ads horizontal scroll section.
class _FeaturedAdsSection extends StatelessWidget {
  final List<Listing> listings;

  const _FeaturedAdsSection({required this.listings});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 230,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2),
        itemCount: listings.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s2),
        itemBuilder: (context, index) => SizedBox(
          width: 180,
          child: _FeaturedAdCard(listing: listings[index]),
        ),
      ),
    );
  }
}

/// Individual featured ad card.
class _FeaturedAdCard extends StatelessWidget {
  final Listing listing;

  const _FeaturedAdCard({required this.listing});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/listings/${listing.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppSpacing.radiusLg),
              ),
              child: Stack(
                children: [
                  Container(
                    height: 140,
                    width: double.infinity,
                    color: AppColors.background,
                    child: listing.images.isNotEmpty
                        ? Image.network(
                            listing.images.first.thumbnailUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.image,
                              size: 40,
                              color: AppColors.textMuted,
                            ),
                          )
                        : const Icon(Icons.image, size: 40, color: AppColors.textMuted),
                  ),
                  // Featured badge
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.star, size: 12, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Featured',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Details
            Padding(
              padding: const EdgeInsets.all(AppSpacing.s1),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: AppTypography.textSm,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${listing.price.amount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: AppTypography.textBase,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      fontFamily: AppTypography.fontFamilyMono,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          listing.location.city,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: AppTypography.textXs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Listing card for the recommendations grid.
class _ListingCard extends StatelessWidget {
  final Listing listing;

  const _ListingCard({required this.listing});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/listings/${listing.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppSpacing.radiusLg),
                ),
                child: Container(
                  width: double.infinity,
                  color: AppColors.background,
                  child: listing.images.isNotEmpty
                      ? Image.network(
                          listing.images.first.thumbnailUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.image,
                            size: 40,
                            color: AppColors.textMuted,
                          ),
                        )
                      : const Icon(Icons.image, size: 40, color: AppColors.textMuted),
                ),
              ),
            ),
            // Details
            Padding(
              padding: const EdgeInsets.all(AppSpacing.s1),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: AppTypography.textSm,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${listing.price.amount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: AppTypography.textSm,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                      fontFamily: AppTypography.fontFamilyMono,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          listing.location.city,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: AppTypography.textXs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shimmer loading skeleton for the home screen.
class _HomeShimmerLoading extends StatelessWidget {
  const _HomeShimmerLoading();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search bar shimmer
          const LoadingShimmer(height: 48, borderRadius: AppSpacing.radiusLg),
          const SizedBox(height: AppSpacing.s2),
          // Category chips shimmer
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s1),
              itemBuilder: (_, __) => const LoadingShimmer(width: 100, height: 40),
            ),
          ),
          const SizedBox(height: AppSpacing.s3),
          // Featured section shimmer
          const LoadingShimmer(height: 24, width: 120),
          const SizedBox(height: AppSpacing.s1),
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: 3,
              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s2),
              itemBuilder: (_, __) => const SizedBox(
                width: 180,
                child: ListingCardShimmer(),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s3),
          // For You grid shimmer
          const LoadingShimmer(height: 24, width: 100),
          const SizedBox(height: AppSpacing.s1),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: AppSpacing.s2,
              crossAxisSpacing: AppSpacing.s2,
              childAspectRatio: 0.72,
            ),
            itemCount: 4,
            itemBuilder: (_, __) => const ListingCardShimmer(),
          ),
        ],
      ),
    );
  }
}
