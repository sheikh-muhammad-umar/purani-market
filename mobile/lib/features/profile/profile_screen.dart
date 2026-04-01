import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'edit_profile_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            key: const Key('settings-button'),
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: user == null
          ? const Center(child: Text('Please log in'))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.s2),
              child: Column(
                children: [
                  const SizedBox(height: AppSpacing.s2),
                  // Avatar
                  CircleAvatar(
                    radius: 48,
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    backgroundImage: user.profile.avatar.isNotEmpty
                        ? NetworkImage(user.profile.avatar)
                        : null,
                    child: user.profile.avatar.isEmpty
                        ? Text(
                            _initials(user.profile.firstName,
                                user.profile.lastName),
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(color: AppColors.primary),
                          )
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.s2),
                  // Name
                  Text(
                    '${user.profile.firstName} ${user.profile.lastName}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.half),
                  // Role badge
                  Chip(
                    label: Text(user.role.name.toUpperCase()),
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    labelStyle: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s3),
                  // Info cards
                  _InfoTile(
                    icon: Icons.email_outlined,
                    label: 'Email',
                    value: user.email ?? 'Not set',
                    verified: user.emailVerified,
                  ),
                  _InfoTile(
                    icon: Icons.phone_outlined,
                    label: 'Phone',
                    value: user.phone ?? 'Not set',
                    verified: user.phoneVerified,
                  ),
                  _InfoTile(
                    icon: Icons.location_on_outlined,
                    label: 'Location',
                    value: user.profile.city.isNotEmpty
                        ? user.profile.city
                        : 'Not set',
                  ),
                  _InfoTile(
                    icon: Icons.calendar_today_outlined,
                    label: 'Member Since',
                    value: DateFormat.yMMMd().format(user.createdAt),
                  ),
                  const SizedBox(height: AppSpacing.s3),
                  // Edit button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      key: const Key('edit-profile-button'),
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const EditProfileScreen()),
                      ),
                      icon: const Icon(Icons.edit),
                      label: const Text('Edit Profile'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s1),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      key: const Key('logout-button'),
                      onPressed: () =>
                          ref.read(authProvider.notifier).logout(),
                      icon: const Icon(Icons.logout),
                      label: const Text('Logout'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  String _initials(String first, String last) {
    final f = first.isNotEmpty ? first[0].toUpperCase() : '';
    final l = last.isNotEmpty ? last[0].toUpperCase() : '';
    return '$f$l';
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool? verified;

  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
    this.verified,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s1),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 24),
          const SizedBox(width: AppSpacing.s2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary)),
                Text(value, style: Theme.of(context).textTheme.bodyLarge),
              ],
            ),
          ),
          if (verified != null)
            Icon(
              verified! ? Icons.verified : Icons.warning_amber_rounded,
              color: verified! ? AppColors.success : AppColors.warning,
              size: 20,
            ),
        ],
      ),
    );
  }
}
