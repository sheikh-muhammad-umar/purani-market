import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/listing.dart';
import 'seller_dashboard_provider.dart';

/// Seller dashboard screen with analytics cards, ad slots meters,
/// and listing management actions.
class SellerDashboardScreen extends ConsumerStatefulWidget {
  const SellerDashboardScreen({super.key});

  @override
  ConsumerState<SellerDashboardScreen> createState() =>
      _SellerDashboardScreenState();
}

class _SellerDashboardScreenState extends ConsumerState<SellerDashboardScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(sellerDashboardProvider.notifier).loadDashboard(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sellerDashboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/listings/create'),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(sellerDashboardProvider.notifier).loadDashboard(),
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.s2),
                children: [
                  // Analytics cards row
                  Row(
                    children: [
                      Expanded(
                        child: _AnalyticsCard(
                          icon: Icons.visibility,
                          label: 'Views',
                          value: state.totalViews.toString(),
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s2),
                      Expanded(
                        child: _AnalyticsCard(
                          icon: Icons.favorite,
                          label: 'Favorites',
                          value: state.totalFavorites.toString(),
                          color: AppColors.secondary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s2),
                      Expanded(
                        child: _AnalyticsCard(
                          icon: Icons.chat,
                          label: 'Messages',
                          value: state.totalMessages.toString(),
                          color: AppColors.accent,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.s3),

                  // Ad slots meter
                  _AdSlotsMeter(
                    used: state.activeAdCount,
                    total: state.totalSlots,
                    freeLimit: state.freeAdLimit,
                    paidSlots: state.paidAdSlots,
                  ),
                  const SizedBox(height: AppSpacing.s2),

                  // Featured ads meter
                  _FeaturedAdsMeter(
                    active: state.featuredAdsActive,
                    total: state.featuredAdsTotal,
                  ),
                  const SizedBox(height: AppSpacing.s3),

                  // Listings section
                  Row(
                    children: [
                      const Text(
                        'My Listings',
                        style: TextStyle(
                          fontSize: AppTypography.textLg,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${state.listings.length} total',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: AppTypography.textSm,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.s1),

                  if (state.listings.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.s4),
                        child: Column(
                          children: [
                            const Icon(
                              Icons.inventory_2_outlined,
                              size: 64,
                              color: AppColors.textMuted,
                            ),
                            const SizedBox(height: AppSpacing.s2),
                            const Text(
                              'No listings yet',
                              style: TextStyle(
                                fontSize: AppTypography.textLg,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.s1),
                            ElevatedButton.icon(
                              onPressed: () => context.push('/listings/create'),
                              icon: const Icon(Icons.add),
                              label: const Text('Create Listing'),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ...state.listings.map(
                      (listing) => _ListingManagementCard(
                        listing: listing,
                        onMarkSold: () => ref
                            .read(sellerDashboardProvider.notifier)
                            .markAsSold(listing.id),
                        onMarkReserved: () => ref
                            .read(sellerDashboardProvider.notifier)
                            .markAsReserved(listing.id),
                        onDelete: () => _confirmDelete(context, listing.id),
                        onFeature: () => ref
                            .read(sellerDashboardProvider.notifier)
                            .featureListing(listing.id),
                        onEdit: () =>
                            context.push('/listings/${listing.id}/edit'),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  void _confirmDelete(BuildContext context, String listingId) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Listing'),
        content: const Text(
          'Are you sure you want to delete this listing?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref
                  .read(sellerDashboardProvider.notifier)
                  .deleteListing(listingId);
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

/// Analytics card widget.
class _AnalyticsCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _AnalyticsCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: AppSpacing.s1),
          Text(
            value,
            style: TextStyle(
              fontSize: AppTypography.textXl,
              fontWeight: FontWeight.w700,
              color: color,
              fontFamily: AppTypography.fontFamilyMono,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: AppTypography.textXs,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Ad slots meter showing free + paid usage.
class _AdSlotsMeter extends StatelessWidget {
  final int used;
  final int total;
  final int freeLimit;
  final int paidSlots;

  const _AdSlotsMeter({
    required this.used,
    required this.total,
    required this.freeLimit,
    required this.paidSlots,
  });

  @override
  Widget build(BuildContext context) {
    final progress = total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
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
          Row(
            children: [
              const Icon(Icons.inventory, size: 18, color: AppColors.primary),
              const SizedBox(width: AppSpacing.s1),
              const Text(
                'Ad Slots',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: AppTypography.textBase,
                ),
              ),
              const Spacer(),
              Text(
                '$used / $total',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                  fontFamily: AppTypography.fontFamilyMono,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s1),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(
                progress > 0.9 ? AppColors.error : AppColors.primary,
              ),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: AppSpacing.half),
          Text(
            'Free: $freeLimit  •  Paid: $paidSlots',
            style: const TextStyle(
              fontSize: AppTypography.textXs,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Featured ads meter with expiration info.
class _FeaturedAdsMeter extends StatelessWidget {
  final int active;
  final int total;

  const _FeaturedAdsMeter({required this.active, required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: AppColors.accent.withOpacity(0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
      child: Row(
        children: [
          const Icon(Icons.star, color: AppColors.accent, size: 20),
          const SizedBox(width: AppSpacing.s1),
          const Text(
            'Featured Ads',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: AppTypography.textBase,
            ),
          ),
          const Spacer(),
          Text(
            '$active active',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.accent,
              fontFamily: AppTypography.fontFamilyMono,
            ),
          ),
          if (total > 0) ...[
            const Text(' / '),
            Text(
              '$total slots',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontFamily: AppTypography.fontFamilyMono,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Listing management card with actions.
class _ListingManagementCard extends StatelessWidget {
  final Listing listing;
  final VoidCallback onMarkSold;
  final VoidCallback onMarkReserved;
  final VoidCallback onDelete;
  final VoidCallback onFeature;
  final VoidCallback onEdit;

  const _ListingManagementCard({
    required this.listing,
    required this.onMarkSold,
    required this.onMarkReserved,
    required this.onDelete,
    required this.onFeature,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s2),
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
        children: [
          // Listing info row
          Padding(
            padding: const EdgeInsets.all(AppSpacing.s2),
            child: Row(
              children: [
                // Thumbnail
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  child: Container(
                    width: 64,
                    height: 64,
                    color: AppColors.background,
                    child: listing.images.isNotEmpty
                        ? Image.network(
                            listing.images.first.thumbnailUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.image,
                              color: AppColors.textMuted,
                            ),
                          )
                        : const Icon(
                            Icons.image,
                            color: AppColors.textMuted,
                          ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        listing.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Rs ${listing.price.amount.toStringAsFixed(0)}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontFamily: AppTypography.fontFamilyMono,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _StatusBadge(status: listing.status),
                          if (listing.isFeatured) ...[
                            const SizedBox(width: AppSpacing.s1),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.accent.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                '★ Featured',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.accent,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                // Stats
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.visibility,
                          size: 14,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${listing.viewCount}',
                          style: const TextStyle(
                            fontSize: AppTypography.textXs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.favorite,
                          size: 14,
                          color: AppColors.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${listing.favoriteCount}',
                          style: const TextStyle(
                            fontSize: AppTypography.textXs,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Action buttons
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s1,
              vertical: AppSpacing.half,
            ),
            child: Row(
              children: [
                _ActionButton(
                  icon: Icons.edit,
                  label: 'Edit',
                  onTap: onEdit,
                ),
                if (listing.status == ListingStatus.active) ...[
                  _ActionButton(
                    icon: Icons.check_circle,
                    label: 'Sold',
                    onTap: onMarkSold,
                  ),
                  _ActionButton(
                    icon: Icons.bookmark,
                    label: 'Reserve',
                    onTap: onMarkReserved,
                  ),
                  if (!listing.isFeatured)
                    _ActionButton(
                      icon: Icons.star,
                      label: 'Feature',
                      onTap: onFeature,
                      color: AppColors.accent,
                    ),
                ],
                const Spacer(),
                _ActionButton(
                  icon: Icons.delete_outline,
                  label: 'Delete',
                  onTap: onDelete,
                  color: AppColors.error,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final ListingStatus status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (Color color, String label) = switch (status) {
      ListingStatus.active => (AppColors.success, 'Active'),
      ListingStatus.pendingReview => (AppColors.warning, 'Pending'),
      ListingStatus.rejected => (AppColors.error, 'Rejected'),
      ListingStatus.sold => (AppColors.textSecondary, 'Sold'),
      ListingStatus.reserved => (AppColors.info, 'Reserved'),
      ListingStatus.deleted => (AppColors.textMuted, 'Deleted'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
      label: Text(
        label,
        style: TextStyle(
          fontSize: AppTypography.textXs,
          color: color ?? AppColors.textSecondary,
        ),
      ),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s1),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}
