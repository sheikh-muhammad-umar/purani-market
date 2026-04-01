import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/user.dart';
import 'profile_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final profileState = ref.watch(profileProvider);

    ref.listen<ProfileState>(profileProvider, (prev, next) {
      if (next.successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.successMessage!),
            backgroundColor: AppColors.success,
          ),
        );
        ref.read(profileProvider.notifier).clearMessages();
      }
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: AppColors.error,
          ),
        );
        ref.read(profileProvider.notifier).clearMessages();
      }
    });

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Settings')),
        body: const Center(child: Text('Please log in')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.s2),
        children: [
          // Email/Phone Change Section
          Text('Account',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: AppColors.primary)),
          const SizedBox(height: AppSpacing.s1),
          _SettingsTile(
            icon: Icons.email_outlined,
            title: 'Change Email',
            subtitle: user.email ?? 'Not set',
            onTap: () => _showChangeEmailDialog(context),
          ),
          _SettingsTile(
            icon: Icons.phone_outlined,
            title: 'Change Phone',
            subtitle: user.phone ?? 'Not set',
            onTap: () => _showChangePhoneDialog(context),
          ),
          const Divider(height: AppSpacing.s4),
          // Notification Preferences Section
          Text('Notifications',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(color: AppColors.primary)),
          const SizedBox(height: AppSpacing.s1),
          _NotificationToggle(
            title: 'Messages',
            subtitle: 'New message notifications',
            value: user.notificationPreferences.messages,
            onChanged: (v) => _updatePref(
              user.notificationPreferences,
              messages: v,
            ),
          ),
          _NotificationToggle(
            title: 'Offers',
            subtitle: 'Price and deal notifications',
            value: user.notificationPreferences.offers,
            onChanged: (v) => _updatePref(
              user.notificationPreferences,
              offers: v,
            ),
          ),
          _NotificationToggle(
            title: 'Product Updates',
            subtitle: 'Status changes on favorited items',
            value: user.notificationPreferences.productUpdates,
            onChanged: (v) => _updatePref(
              user.notificationPreferences,
              productUpdates: v,
            ),
          ),
          _NotificationToggle(
            title: 'Promotions',
            subtitle: 'Platform promotions and deals',
            value: user.notificationPreferences.promotions,
            onChanged: (v) => _updatePref(
              user.notificationPreferences,
              promotions: v,
            ),
          ),
          _NotificationToggle(
            title: 'Package Alerts',
            subtitle: 'Ad package and payment updates',
            value: user.notificationPreferences.packageAlerts,
            onChanged: (v) => _updatePref(
              user.notificationPreferences,
              packageAlerts: v,
            ),
          ),
        ],
      ),
    );
  }

  void _updatePref(
    NotificationPreferences current, {
    bool? messages,
    bool? offers,
    bool? productUpdates,
    bool? promotions,
    bool? packageAlerts,
  }) {
    final updated = NotificationPreferences(
      messages: messages ?? current.messages,
      offers: offers ?? current.offers,
      productUpdates: productUpdates ?? current.productUpdates,
      promotions: promotions ?? current.promotions,
      packageAlerts: packageAlerts ?? current.packageAlerts,
    );
    ref.read(profileProvider.notifier).updateNotificationPreferences(updated);
  }

  void _showChangeEmailDialog(BuildContext context) {
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Email'),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'New Email',
              hintText: 'Enter new email address',
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Required';
              if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())) {
                return 'Invalid email';
              }
              return null;
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            key: const Key('confirm-email-change'),
            onPressed: () {
              if (formKey.currentState!.validate()) {
                ref
                    .read(profileProvider.notifier)
                    .changeEmail(controller.text.trim());
                Navigator.of(ctx).pop();
              }
            },
            child: const Text('Send Verification'),
          ),
        ],
      ),
    );
  }

  void _showChangePhoneDialog(BuildContext context) {
    final controller = TextEditingController();
    final otpController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => Consumer(
        builder: (ctx, ref, _) {
          final state = ref.watch(profileProvider);
          return AlertDialog(
            title: const Text('Change Phone'),
            content: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: controller,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'New Phone Number',
                      hintText: '+92XXXXXXXXXX',
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  if (state.verificationSent) ...[
                    const SizedBox(height: AppSpacing.s2),
                    TextFormField(
                      controller: otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'OTP Code',
                        hintText: '6-digit code',
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Required';
                        if (v.trim().length != 6) return 'Must be 6 digits';
                        return null;
                      },
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                key: const Key('confirm-phone-change'),
                onPressed: state.isLoading
                    ? null
                    : () {
                        if (!formKey.currentState!.validate()) return;
                        if (state.verificationSent) {
                          ref
                              .read(profileProvider.notifier)
                              .verifyPhoneChange(otpController.text.trim());
                        } else {
                          ref
                              .read(profileProvider.notifier)
                              .changePhone(controller.text.trim());
                        }
                      },
                child: Text(
                    state.verificationSent ? 'Verify OTP' : 'Send OTP'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

class _NotificationToggle extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _NotificationToggle({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(subtitle),
      value: value,
      activeColor: AppColors.primary,
      onChanged: onChanged,
    );
  }
}
