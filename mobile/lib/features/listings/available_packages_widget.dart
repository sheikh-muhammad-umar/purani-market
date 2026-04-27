import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/ad_package.dart';
import '../../utils/constants.dart';
import '../packages/packages_provider.dart';

/// Widget that displays available packages for a selected category
/// during listing creation. Allows the seller to pick a package
/// and emits the selected [purchaseId] via [onPackageSelected].
class AvailablePackagesWidget extends ConsumerStatefulWidget {
  final String categoryId;
  final ValueChanged<String?> onPackageSelected;

  const AvailablePackagesWidget({
    super.key,
    required this.categoryId,
    required this.onPackageSelected,
  });

  @override
  ConsumerState<AvailablePackagesWidget> createState() =>
      _AvailablePackagesWidgetState();
}

class _AvailablePackagesWidgetState
    extends ConsumerState<AvailablePackagesWidget> {
  String? _selectedPurchaseId;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadPackages());
  }

  @override
  void didUpdateWidget(covariant AvailablePackagesWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoryId != widget.categoryId) {
      setState(() => _selectedPurchaseId = null);
      widget.onPackageSelected(null);
      Future.microtask(() => _loadPackages());
    }
  }

  void _loadPackages() {
    ref
        .read(packagesProvider.notifier)
        .loadAvailablePackages(widget.categoryId);
  }

  void _trackEvent(String action, Map<String, dynamic> metadata) {
    try {
      ref.read(apiClientProvider).post(
        AppConstants.trackEndpoint,
        data: {
          'action': action,
          'categoryId': widget.categoryId,
          'metadata': metadata,
        },
      );
    } catch (_) {
      // Tracking should never block UX
    }
  }

  void _onPackageSelected(PackagePurchase purchase) {
    setState(() => _selectedPurchaseId = purchase.id);
    widget.onPackageSelected(purchase.id);

    _trackEvent(AppConstants.packageApply, {
      'purchaseId': purchase.id,
      'packageType': purchase.type.name,
      'categoryId': widget.categoryId,
    });
  }

  void _onPackageDeselected() {
    setState(() => _selectedPurchaseId = null);
    widget.onPackageSelected(null);
  }

  void _onPurchaseCtaClicked() {
    _trackEvent(AppConstants.packagePurchaseCtaClicked, {
      'categoryId': widget.categoryId,
      'source': 'listing_creation',
    });
    context.push(AppConstants.packagesRoute);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(packagesProvider);
    final packages = state.availablePackages;

    // Fire tracking events after packages load
    ref.listen<PackagesState>(packagesProvider, (prev, next) {
      if (prev?.isLoading == true && !next.isLoading && next.error == null) {
        _trackEvent(AppConstants.packageListViewed, {
          'categoryId': widget.categoryId,
          'availablePackageCount': next.availablePackages.length,
        });
        if (next.availablePackages.isEmpty) {
          _trackEvent(AppConstants.packageNoneAvailable, {
            'categoryId': widget.categoryId,
          });
        }
      }
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Apply Package',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: AppSpacing.s1),
        if (state.isLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.s2),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              ),
            ),
          )
        else if (state.error != null)
          _ErrorMessage(
            message: 'Failed to load packages.',
            onRetry: _loadPackages,
          )
        else if (packages.isEmpty)
          _EmptyPackagesMessage(onPurchaseTap: _onPurchaseCtaClicked)
        else
          ..._buildPackageList(context, packages),
      ],
    );
  }

  List<Widget> _buildPackageList(
    BuildContext context,
    List<PackagePurchase> packages,
  ) {
    return [
      Text(
        '${packages.length} package${packages.length == 1 ? '' : 's'} available',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
      ),
      const SizedBox(height: AppSpacing.s1),
      ...packages.map((purchase) {
        final isSelected = _selectedPurchaseId == purchase.id;
        return _AvailablePackageCard(
          purchase: purchase,
          isSelected: isSelected,
          onTap: () {
            if (isSelected) {
              _onPackageDeselected();
            } else {
              _onPackageSelected(purchase);
            }
          },
        );
      }),
    ];
  }
}


/// Card displaying a single available package purchase.
class _AvailablePackageCard extends StatelessWidget {
  final PackagePurchase purchase;
  final bool isSelected;
  final VoidCallback onTap;

  const _AvailablePackageCard({
    required this.purchase,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final typeLabel = purchase.type == PackageType.featuredAds
        ? 'Featured Ads'
        : 'Ad Slots';
    final icon = purchase.type == PackageType.featuredAds
        ? Icons.star
        : Icons.add_box_outlined;
    final expiryText = _formatExpiry(purchase.expiresAt);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
          width: isSelected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s2),
          child: Row(
            children: [
              Icon(icon, color: AppColors.accent, size: 28),
              const SizedBox(width: AppSpacing.s1),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      typeLabel,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${purchase.remainingQuantity}/${purchase.quantity} remaining · $expiryText',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(Icons.check_circle, color: AppColors.primary)
              else
                const Icon(Icons.radio_button_unchecked,
                    color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }

  String _formatExpiry(DateTime? expiresAt) {
    if (expiresAt == null) return 'No expiry';
    final remaining = expiresAt.difference(DateTime.now()).inDays;
    if (remaining <= 0) return 'Expiring today';
    final formatted = DateFormat('MMM d, y').format(expiresAt);
    return 'Expires $formatted ($remaining day${remaining == 1 ? '' : 's'})';
  }
}

/// Message shown when no packages are available for the category.
class _EmptyPackagesMessage extends StatelessWidget {
  final VoidCallback onPurchaseTap;

  const _EmptyPackagesMessage({required this.onPurchaseTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          const Icon(Icons.inventory_2_outlined,
              color: AppColors.textMuted, size: 32),
          const SizedBox(height: AppSpacing.s1),
          Text(
            'No packages available for this category',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.s1),
          TextButton(
            onPressed: onPurchaseTap,
            child: const Text('Purchase Packages'),
          ),
        ],
      ),
    );
  }
}

/// Error message with retry button.
class _ErrorMessage extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorMessage({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.05),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: AppColors.error.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
          const SizedBox(width: AppSpacing.s1),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.error,
                  ),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
