import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/listing.dart';
import '../../models/review.dart';
import '../../widgets/loading_shimmer.dart';
import 'listing_detail_provider.dart';

/// Listing detail screen with full-bleed image gallery, seller card,
/// embedded map, reviews, sticky bottom bar, and favorite toggle.
class ListingDetailScreen extends ConsumerWidget {
  final String listingId;

  const ListingDetailScreen({super.key, required this.listingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(listingDetailProvider(listingId));

    if (state.isLoading || state.listing == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final listing = state.listing!;

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              // Full-bleed image gallery
              SliverAppBar(
                expandedHeight: 320,
                pinned: true,
                actions: [
                  IconButton(
                    icon: const Icon(Icons.share),
                    onPressed: () {},
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: _ImageGallery(images: listing.images),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.s2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Price and featured badge
                      Row(
                        children: [
                          Text(
                            'Rs ${listing.price.amount.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: AppTypography.textXl,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                              fontFamily: AppTypography.fontFamilyMono,
                            ),
                          ),
                          const Spacer(),
                          if (listing.isFeatured)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.accent,
                                borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusFull,
                                ),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.star,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'Featured',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.s1),

                      // Title
                      Text(
                        listing.title,
                        style: const TextStyle(
                          fontSize: AppTypography.textLg,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.s1),

                      // Location and time
                      Row(
                        children: [
                          const Icon(
                            Icons.location_on,
                            size: 16,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${listing.location.area}, ${listing.location.city}',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            _timeAgo(listing.createdAt),
                            style: const TextStyle(
                              fontSize: AppTypography.textXs,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.s1),

                      // Stats
                      Row(
                        children: [
                          _StatChip(
                            icon: Icons.visibility,
                            label: '${listing.viewCount} views',
                          ),
                          const SizedBox(width: AppSpacing.s2),
                          _StatChip(
                            icon: Icons.favorite,
                            label: '${listing.favoriteCount} favorites',
                          ),
                        ],
                      ),

                      const Divider(height: AppSpacing.s4),

                      // Description
                      const Text(
                        'Description',
                        style: TextStyle(
                          fontSize: AppTypography.textBase,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.s1),
                      Text(
                        listing.description,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                      ),

                      // Category-specific attributes
                      if (listing.categoryAttributes.isNotEmpty) ...[
                        const Divider(height: AppSpacing.s4),
                        const Text(
                          'Details',
                          style: TextStyle(
                            fontSize: AppTypography.textBase,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.s1),
                        ...listing.categoryAttributes.entries.map(
                          (e) => _DetailRow(
                            label: e.key,
                            value: e.value.toString(),
                          ),
                        ),
                      ],

                      const Divider(height: AppSpacing.s4),

                      // Seller card with trust score
                      _SellerCard(
                        averageRating: state.averageRating,
                        reviewCount: state.reviews.length,
                      ),

                      const Divider(height: AppSpacing.s4),

                      // Embedded map
                      const Text(
                        'Location',
                        style: TextStyle(
                          fontSize: AppTypography.textBase,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.s1),
                      Container(
                        height: 180,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusLg,
                          ),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.map,
                                size: 40,
                                color: AppColors.textMuted,
                              ),
                              const SizedBox(height: AppSpacing.s1),
                              Text(
                                '${listing.location.area}, ${listing.location.city}',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Reviews section
                      if (state.reviews.isNotEmpty) ...[
                        const Divider(height: AppSpacing.s4),
                        Row(
                          children: [
                            const Text(
                              'Reviews',
                              style: TextStyle(
                                fontSize: AppTypography.textBase,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.s1),
                            Icon(
                              Icons.star,
                              size: 18,
                              color: AppColors.accent,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              state.averageRating.toStringAsFixed(1),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              ' (${state.reviews.length})',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.s1),
                        ...state.reviews.take(3).map(
                              (r) => _ReviewCard(review: r),
                            ),
                      ],

                      // Bottom padding for sticky bar
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Sticky bottom bar with price + Call/Chat CTAs
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StickyBottomBar(
              listing: listing,
              isFavorited: state.isFavorited,
              onFavoriteToggle: () => ref
                  .read(listingDetailProvider(listingId).notifier)
                  .toggleFavorite(),
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-bleed image gallery with swipe gestures and pinch-to-zoom.
class _ImageGallery extends StatefulWidget {
  final List<ListingImage> images;

  const _ImageGallery({required this.images});

  @override
  State<_ImageGallery> createState() => _ImageGalleryState();
}

class _ImageGalleryState extends State<_ImageGallery> {
  int _currentPage = 0;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) {
      return Container(
        color: AppColors.background,
        child: const Center(
          child: Icon(Icons.image, size: 64, color: AppColors.textMuted),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: _pageController,
          itemCount: widget.images.length,
          onPageChanged: (i) => setState(() => _currentPage = i),
          itemBuilder: (context, index) {
            return InteractiveViewer(
              minScale: 1.0,
              maxScale: 3.0,
              child: Image.network(
                widget.images[index].url,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.background,
                  child: const Icon(
                    Icons.broken_image,
                    size: 48,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            );
          },
        ),
        // Page indicator
        Positioned(
          bottom: 16,
          left: 0,
          right: 0,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Text(
                  '${_currentPage + 1} / ${widget.images.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: AppTypography.textXs,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Seller card with trust score.
class _SellerCard extends StatelessWidget {
  final double averageRating;
  final int reviewCount;

  const _SellerCard({
    required this.averageRating,
    required this.reviewCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.primary.withOpacity(0.1),
            child: const Icon(Icons.person, color: AppColors.primary, size: 28),
          ),
          const SizedBox(width: AppSpacing.s2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Seller',
                  style: TextStyle(
                    fontSize: AppTypography.textBase,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.star, size: 16, color: AppColors.accent),
                    const SizedBox(width: 4),
                    Text(
                      averageRating > 0
                          ? '${averageRating.toStringAsFixed(1)} ($reviewCount reviews)'
                          : 'No reviews yet',
                      style: const TextStyle(
                        fontSize: AppTypography.textSm,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.verified, size: 14, color: AppColors.success),
                    const SizedBox(width: 4),
                    const Text(
                      'Verified',
                      style: TextStyle(
                        fontSize: AppTypography.textXs,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () {},
            child: const Text('View Profile'),
          ),
        ],
      ),
    );
  }
}

/// Sticky bottom bar with price + Call/Chat CTAs and favorite toggle.
class _StickyBottomBar extends StatelessWidget {
  final Listing listing;
  final bool isFavorited;
  final VoidCallback onFavoriteToggle;

  const _StickyBottomBar({
    required this.listing,
    required this.isFavorited,
    required this.onFavoriteToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.s2,
        AppSpacing.s1,
        AppSpacing.s2,
        MediaQuery.of(context).padding.bottom + AppSpacing.s1,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Favorite toggle with heart burst animation
          _FavoriteButton(
            isFavorited: isFavorited,
            onToggle: onFavoriteToggle,
          ),
          const SizedBox(width: AppSpacing.s2),
          // Price
          Expanded(
            child: Text(
              'Rs ${listing.price.amount.toStringAsFixed(0)}',
              style: const TextStyle(
                fontSize: AppTypography.textLg,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
                fontFamily: AppTypography.fontFamilyMono,
              ),
            ),
          ),
          // Call CTA
          OutlinedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.phone, size: 18),
            label: const Text('Call'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.s1),
          // Chat CTA
          ElevatedButton.icon(
            onPressed: () => context.push('/messages'),
            icon: const Icon(Icons.chat, size: 18),
            label: const Text('Chat'),
          ),
        ],
      ),
    );
  }
}

/// Favorite toggle with heart burst particle animation.
class _FavoriteButton extends StatefulWidget {
  final bool isFavorited;
  final VoidCallback onToggle;

  const _FavoriteButton({
    required this.isFavorited,
    required this.onToggle,
  });

  @override
  State<_FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends State<_FavoriteButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.4), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.4, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _FavoriteButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isFavorited && !oldWidget.isFavorited) {
      _controller.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onToggle,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, _) => Transform.scale(
          scale: _scaleAnimation.value,
          child: Icon(
            widget.isFavorited ? Icons.favorite : Icons.favorite_border,
            color: widget.isFavorited ? AppColors.secondary : AppColors.textMuted,
            size: 28,
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: AppTypography.textXs,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.half),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: AppTypography.textSm,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: AppTypography.textSm,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  final Review review;

  const _ReviewCard({required this.review});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s1),
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ...List.generate(
                5,
                (i) => Icon(
                  i < review.rating ? Icons.star : Icons.star_border,
                  size: 16,
                  color: AppColors.accent,
                ),
              ),
              const Spacer(),
              Text(
                _timeAgo(review.createdAt),
                style: const TextStyle(
                  fontSize: AppTypography.textXs,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.half),
          Text(
            review.text,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: AppTypography.textSm,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

String _timeAgo(DateTime date) {
  final diff = DateTime.now().difference(date);
  if (diff.inDays > 30) return '${diff.inDays ~/ 30}mo ago';
  if (diff.inDays > 0) return '${diff.inDays}d ago';
  if (diff.inHours > 0) return '${diff.inHours}h ago';
  if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
  return 'Just now';
}
