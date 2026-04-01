import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/ad_package.dart';
import 'packages_provider.dart';

/// Packages screen with tabs: Available Packages, My Packages.
class PackagesScreen extends ConsumerStatefulWidget {
  const PackagesScreen({super.key});

  @override
  ConsumerState<PackagesScreen> createState() => _PackagesScreenState();
}

class _PackagesScreenState extends ConsumerState<PackagesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    Future.microtask(() {
      ref.read(packagesProvider.notifier).loadPackages();
      ref.read(packagesProvider.notifier).loadMyPurchases();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ad Packages'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Available'),
            Tab(text: 'My Packages'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _PackageListTab(),
          _MyPackagesTab(),
        ],
      ),
    );
  }
}

/// Available packages list.
class _PackageListTab extends ConsumerWidget {
  const _PackageListTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(packagesProvider);

    if (state.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.packages.isEmpty) {
      return const Center(child: Text('No packages available'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.s2),
      itemCount: state.packages.length,
      itemBuilder: (context, index) {
        final pkg = state.packages[index];
        return _PackageCard(
          package: pkg,
          onPurchase: () => _showPurchaseSheet(context, ref, pkg),
        );
      },
    );
  }

  void _showPurchaseSheet(
      BuildContext context, WidgetRef ref, AdPackage pkg) {
    ref.read(purchaseFlowProvider.notifier).reset();
    ref.read(purchaseFlowProvider.notifier).selectPackage(pkg.id);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _PurchaseFlowSheet(package: pkg),
    );
  }
}

class _PackageCard extends StatelessWidget {
  final AdPackage package;
  final VoidCallback onPurchase;

  const _PackageCard({required this.package, required this.onPurchase});

  @override
  Widget build(BuildContext context) {
    final typeLabel = package.type == PackageType.featuredAds
        ? 'Featured Ads'
        : 'Ad Slots';
    final icon = package.type == PackageType.featuredAds
        ? Icons.star
        : Icons.add_box_outlined;

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s2),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppColors.accent, size: 28),
                const SizedBox(width: AppSpacing.s1),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(package.name,
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(typeLabel,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Text(
                  'PKR ${package.defaultPrice.toStringAsFixed(0)}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s1),
            Row(
              children: [
                _InfoChip(
                    icon: Icons.timer, label: '${package.duration} days'),
                const SizedBox(width: AppSpacing.s1),
                _InfoChip(
                    icon: Icons.inventory_2,
                    label: '${package.quantity} ads'),
              ],
            ),
            const SizedBox(height: AppSpacing.s2),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onPurchase,
                child: const Text('Purchase'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(label,
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

/// Purchase flow bottom sheet with payment method selection.
class _PurchaseFlowSheet extends ConsumerWidget {
  final AdPackage package;
  const _PurchaseFlowSheet({required this.package});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(purchaseFlowProvider);

    if (state.isSuccess) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.s4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: AppColors.success, size: 64),
            const SizedBox(height: AppSpacing.s2),
            Text('Purchase Successful!',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.s2),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.s2,
        right: AppSpacing.s2,
        top: AppSpacing.s2,
        bottom: MediaQuery.of(context).padding.bottom + AppSpacing.s2,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s2),
          Text('Purchase ${package.name}',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.s1),
          Text(
            'PKR ${package.defaultPrice.toStringAsFixed(0)} · ${package.duration} days · ${package.quantity} ads',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s3),
          Text('Select Payment Method',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.s1),
          _PaymentMethodTile(
            label: 'JazzCash',
            icon: Icons.phone_android,
            color: AppColors.secondary,
            isSelected: state.selectedPaymentMethod == PaymentMethod.jazzcash,
            onTap: () => ref
                .read(purchaseFlowProvider.notifier)
                .selectPaymentMethod(PaymentMethod.jazzcash),
          ),
          _PaymentMethodTile(
            label: 'EasyPaisa',
            icon: Icons.phone_android,
            color: AppColors.success,
            isSelected: state.selectedPaymentMethod == PaymentMethod.easypaisa,
            onTap: () => ref
                .read(purchaseFlowProvider.notifier)
                .selectPaymentMethod(PaymentMethod.easypaisa),
          ),
          _PaymentMethodTile(
            label: 'Credit/Debit Card',
            icon: Icons.credit_card,
            color: AppColors.info,
            isSelected: state.selectedPaymentMethod == PaymentMethod.card,
            onTap: () => ref
                .read(purchaseFlowProvider.notifier)
                .selectPaymentMethod(PaymentMethod.card),
          ),
          if (state.error != null) ...[
            const SizedBox(height: AppSpacing.s1),
            Text(state.error!,
                style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ],
          const SizedBox(height: AppSpacing.s3),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: state.isPurchasing
                  ? null
                  : () =>
                      ref.read(purchaseFlowProvider.notifier).purchase(),
              child: state.isPurchasing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Confirm Purchase'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentMethodTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _PaymentMethodTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.border,
          width: isSelected ? 2 : 1,
        ),
      ),
      child: ListTile(
        leading: Icon(icon, color: color),
        title: Text(label),
        trailing: isSelected
            ? const Icon(Icons.check_circle, color: AppColors.primary)
            : null,
        onTap: onTap,
      ),
    );
  }
}

/// My packages tab showing purchase history.
class _MyPackagesTab extends ConsumerWidget {
  const _MyPackagesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(packagesProvider);

    if (state.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.myPurchases.isEmpty) {
      return const Center(child: Text('No purchases yet'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.s2),
      itemCount: state.myPurchases.length,
      itemBuilder: (context, index) {
        final purchase = state.myPurchases[index];
        return _PurchaseCard(purchase: purchase);
      },
    );
  }
}

class _PurchaseCard extends StatelessWidget {
  final PackagePurchase purchase;
  const _PurchaseCard({required this.purchase});

  @override
  Widget build(BuildContext context) {
    final isActive = purchase.paymentStatus == PaymentStatus.completed &&
        purchase.expiresAt != null &&
        purchase.expiresAt!.isAfter(DateTime.now());

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.s2),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    purchase.type == PackageType.featuredAds
                        ? 'Featured Ads Package'
                        : 'Ad Slots Package',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isActive
                        ? AppColors.success.withOpacity(0.15)
                        : AppColors.textMuted.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isActive ? 'Active' : purchase.paymentStatus.name,
                    style: TextStyle(
                      color: isActive ? AppColors.success : AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s1),
            Text(
              'PKR ${purchase.price.toStringAsFixed(0)} · ${purchase.duration} days · ${purchase.remainingQuantity}/${purchase.quantity} remaining',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.textSecondary),
            ),
            if (purchase.expiresAt != null) ...[
              const SizedBox(height: 4),
              Text(
                'Expires: ${purchase.expiresAt!.day}/${purchase.expiresAt!.month}/${purchase.expiresAt!.year}',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(color: AppColors.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
