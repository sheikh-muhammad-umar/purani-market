import 'package:flutter/material.dart';

/// Elevation / shadow tokens matching the web frontend.
class AppShadows {
  AppShadows._();

  static List<BoxShadow> get card => [
        BoxShadow(
          offset: const Offset(0, 2),
          blurRadius: 8,
          color: Colors.black.withValues(alpha: 0.08),
        ),
      ];

  static List<BoxShadow> get hover => [
        BoxShadow(
          offset: const Offset(0, 8),
          blurRadius: 24,
          color: Colors.black.withValues(alpha: 0.12),
        ),
      ];

  static List<BoxShadow> get modal => [
        BoxShadow(
          offset: const Offset(0, 16),
          blurRadius: 48,
          color: Colors.black.withValues(alpha: 0.16),
        ),
      ];

  static List<BoxShadow> get dropdown => [
        BoxShadow(
          offset: const Offset(0, 4),
          blurRadius: 16,
          color: Colors.black.withValues(alpha: 0.10),
        ),
      ];
}
