import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/listing.dart';
import 'favorites_provider.dart';

/// Favorites list screen showing saved listings with current status/price.
class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(favoritesProvider.notifier).loadFavorites(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(favoritesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.error),
                      const SizedBox(height: AppSpacing.s1),
                      Text(state.error!),
                      const SizedBox(height: AppSpacing.s2),
                      ElevatedButton(
                        onPressed: () => ref
                            .read(favoritesProvider.notifier)
                            .loadFavorites(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : state.favorites.isEmpty
                  ? _buildEmptyState(context)
                  : RefreshIndicator(
                      onRefresh: () =>
                          ref.read(favoritesProvider.notifier).loadFavorites(),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(AppSpacing.s2),
                        itemCount: state.favorites.length,
                        itemBuilder: (context, index) {
                          final item = state.favorites[index];
                          return _FavoriteCard(
                            item: item,
                            onTap: () =>
                                context.push('/listings/${item.listing.id}'),
                            onRemove: () => ref
                                .read(favoritesProvider.notifier)
                                .removeFavorite(item.favorite.id),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.favorite_border,
              size: 64, color: AppColors.textMuted.withOpacity(0.5)),
          const SizedBox(height: AppSpacing.s2),
          Text('No favorites yet',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: AppSpacing.s1),
          Text('Tap the heart icon on listings to save them here',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

class _FavoriteCard extends StatelessWidget {
  final FavoriteWithListing item;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const _FavoriteCard({
    required this.item,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final listing = item.listing;
    final imageUrl = listing.images.isNotEmpty
        ? listing.images.first.thumbnailUrl
        : null;
    final isSold = listing.status == ListingStatus.sold;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s2),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Opacity(
          opacity: isSold ? 0.6 : 1.0,
          child: Row(
            children: [
              // Image
              SizedBox(
                width: 100,
                height: 100,
                child: imageUrl != null
                    ? Image.network(imageUrl, fit: BoxFit.cover)
                    : Container(
                        color: AppColors.primaryLight,
                        child: const Icon(Icons.image,
                            color: AppColors.primary, size: 32),
                      ),
              ),
              // Details
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.s1),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(listing.title,
                          style: Theme.of(context).textTheme.titleSmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Text(
                        '${listing.price.currency} ${listing.price.amount.toStringAsFixed(0)}',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _StatusBadge(status: listing.status),
                          const Spacer(),
                          Text(listing.location.city,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(color: AppColors.textMuted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              // Remove button
              IconButton(
                icon: const Icon(Icons.favorite, color: AppColors.secondary),
                onPressed: onRemove,
                tooltip: 'Remove from favorites',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final ListingStatus status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    switch (status) {
      case ListingStatus.active:
        color = AppColors.success;
        label = 'Active';
      case ListingStatus.sold:
        color = AppColors.error;
        label = 'Sold';
      case ListingStatus.reserved:
        color = AppColors.warning;
        label = 'Reserved';
      default:
        color = AppColors.textMuted;
        label = status.name;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
