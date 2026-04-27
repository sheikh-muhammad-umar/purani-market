import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';

/// A dialog that warns sellers about permanent package consumption
/// before deleting or deactivating a listing with an applied package.
///
/// Returns `true` if the user confirms, `false` if cancelled.
class PackageConfirmationDialog extends StatelessWidget {
  final String packageName;
  final String packageType;
  final String actionType; // 'delete' | 'deactivate'

  const PackageConfirmationDialog({
    super.key,
    required this.packageName,
    required this.packageType,
    required this.actionType,
  });

  /// Shows the dialog and returns `true` on confirm, `false`/`null` on cancel.
  static Future<bool?> show({
    required BuildContext context,
    required String packageName,
    required String packageType,
    required String actionType,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (_) => PackageConfirmationDialog(
        packageName: packageName,
        packageType: packageType,
        actionType: actionType,
      ),
    );
  }

  String get _actionLabel =>
      actionType == 'delete' ? 'Delete' : 'Deactivate';

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      icon: const Icon(
        Icons.warning_amber_rounded,
        color: AppColors.accent,
        size: 40,
      ),
      title: Text('$_actionLabel Listing'),
      content: Text(
        "This listing has the package '$packageName' ($packageType) applied. "
        'The consumed package unit is non-recoverable and will not be '
        'restored if you $actionType this listing.',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
              height: 1.5,
            ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.s2,
        0,
        AppSpacing.s2,
        AppSpacing.s2,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          style: TextButton.styleFrom(
            foregroundColor: actionType == 'delete'
                ? AppColors.error
                : AppColors.accent,
          ),
          child: Text(_actionLabel),
        ),
      ],
    );
  }
}
