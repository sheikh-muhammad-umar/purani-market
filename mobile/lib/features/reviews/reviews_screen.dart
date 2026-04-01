import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/review.dart';
import 'reviews_provider.dart';

/// Reviews display screen showing reviews for a seller or listing.
class ReviewsScreen extends ConsumerStatefulWidget {
  final String? sellerId;
  final String? listingId;

  const ReviewsScreen({super.key, this.sellerId, this.listingId});

  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final notifier = ref.read(reviewsProvider.notifier);
      if (widget.sellerId != null) {
        notifier.loadReviewsForSeller(widget.sellerId!);
      } else if (widget.listingId != null) {
        notifier.loadReviewsForListing(widget.listingId!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reviewsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Reviews')),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? Center(child: Text(state.error!))
              : state.reviews.isEmpty
                  ? const Center(child: Text('No reviews yet'))
                  : Column(
                      children: [
                        // Average rating header
                        _RatingHeader(
                          average: state.averageRating,
                          count: state.reviews.length,
                        ),
                        const Divider(),
                        // Reviews list
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.all(AppSpacing.s2),
                            itemCount: state.reviews.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 24),
                            itemBuilder: (context, index) =>
                                _ReviewCard(review: state.reviews[index]),
                          ),
                        ),
                      ],
                    ),
    );
  }
}

class _RatingHeader extends StatelessWidget {
  final double average;
  final int count;

  const _RatingHeader({required this.average, required this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.s2),
      child: Row(
        children: [
          Text(
            average.toStringAsFixed(1),
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppColors.accent,
                ),
          ),
          const SizedBox(width: AppSpacing.s1),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: List.generate(5, (i) {
                  return Icon(
                    i < average.round() ? Icons.star : Icons.star_border,
                    color: AppColors.accent,
                    size: 20,
                  );
                }),
              ),
              Text('$count reviews',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textMuted)),
            ],
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.primaryLight,
              child: Icon(Icons.person, size: 18, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.s1),
            Expanded(
              child: Text('Reviewer',
                  style: Theme.of(context).textTheme.titleSmall),
            ),
            Row(
              children: List.generate(5, (i) {
                return Icon(
                  i < review.rating ? Icons.star : Icons.star_border,
                  color: AppColors.accent,
                  size: 16,
                );
              }),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s1),
        Text(review.text, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 4),
        Text(
          _formatDate(review.createdAt),
          style: Theme.of(context)
              .textTheme
              .labelSmall
              ?.copyWith(color: AppColors.textMuted),
        ),
      ],
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

/// Write review screen with star rating and text input.
class WriteReviewScreen extends ConsumerWidget {
  final String sellerId;
  final String productListingId;

  const WriteReviewScreen({
    super.key,
    required this.sellerId,
    required this.productListingId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(writeReviewProvider);

    if (state.isSuccess) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pop(true);
      });
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Write Review')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.s2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Rate your experience',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.s2),
            // Star rating
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final starIndex = i + 1;
                return IconButton(
                  icon: Icon(
                    starIndex <= state.rating
                        ? Icons.star
                        : Icons.star_border,
                    color: AppColors.accent,
                    size: 40,
                  ),
                  onPressed: () => ref
                      .read(writeReviewProvider.notifier)
                      .setRating(starIndex),
                );
              }),
            ),
            const SizedBox(height: AppSpacing.s2),
            // Text input
            TextField(
              maxLines: 5,
              maxLength: 2000,
              onChanged: (v) =>
                  ref.read(writeReviewProvider.notifier).setText(v),
              decoration: const InputDecoration(
                hintText: 'Share your experience...',
                alignLabelWithHint: true,
              ),
            ),
            if (state.error != null) ...[
              const SizedBox(height: AppSpacing.s1),
              Text(state.error!,
                  style: const TextStyle(color: AppColors.error)),
            ],
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: state.isSubmitting
                    ? null
                    : () => ref.read(writeReviewProvider.notifier).submit(
                          sellerId: sellerId,
                          productListingId: productListingId,
                        ),
                child: state.isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Submit Review'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
