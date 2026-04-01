import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';

/// Shimmer loading placeholder matching the web skeleton loading style.
class LoadingShimmer extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const LoadingShimmer({
    super.key,
    this.width = double.infinity,
    this.height = 100,
    this.borderRadius = AppSpacing.radiusSm,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.border,
      highlightColor: AppColors.background,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Card-shaped shimmer placeholder for listing cards.
class ListingCardShimmer extends StatelessWidget {
  const ListingCardShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const LoadingShimmer(height: 160, borderRadius: AppSpacing.radiusLg),
        const SizedBox(height: AppSpacing.s1),
        const LoadingShimmer(height: 16, width: 120),
        const SizedBox(height: AppSpacing.half),
        const LoadingShimmer(height: 14, width: 80),
        const SizedBox(height: AppSpacing.half),
        const LoadingShimmer(height: 12, width: 100),
      ],
    );
  }
}
