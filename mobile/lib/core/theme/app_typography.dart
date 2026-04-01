import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography tokens matching the web frontend (Inter font family).
class AppTypography {
  AppTypography._();

  static const String fontFamilyHeading = 'Inter';
  static const String fontFamilyBody = 'Inter';
  static const String fontFamilyMono = 'JetBrainsMono';

  // Font sizes matching web: 12/14/16/20/24/32/40
  static const double textXs = 12.0;
  static const double textSm = 14.0;
  static const double textBase = 16.0;
  static const double textLg = 20.0;
  static const double textXl = 24.0;
  static const double text2xl = 32.0;
  static const double text3xl = 40.0;

  static const double leadingTight = 1.25;
  static const double leadingNormal = 1.5;
  static const double leadingRelaxed = 1.75;

  static TextTheme get lightTextTheme => _buildTextTheme(AppColors.textPrimary);
  static TextTheme get darkTextTheme => _buildTextTheme(AppColors.darkTextPrimary);

  static TextTheme _buildTextTheme(Color textColor) {
    return TextTheme(
      displayLarge: TextStyle(
        fontFamily: fontFamilyHeading,
        fontSize: text3xl,
        fontWeight: FontWeight.w700,
        height: leadingTight,
        color: textColor,
      ),
      displayMedium: TextStyle(
        fontFamily: fontFamilyHeading,
        fontSize: text2xl,
        fontWeight: FontWeight.w700,
        height: leadingTight,
        color: textColor,
      ),
      displaySmall: TextStyle(
        fontFamily: fontFamilyHeading,
        fontSize: textXl,
        fontWeight: FontWeight.w700,
        height: leadingTight,
        color: textColor,
      ),
      headlineMedium: TextStyle(
        fontFamily: fontFamilyHeading,
        fontSize: textLg,
        fontWeight: FontWeight.w700,
        height: leadingTight,
        color: textColor,
      ),
      titleLarge: TextStyle(
        fontFamily: fontFamilyHeading,
        fontSize: textLg,
        fontWeight: FontWeight.w600,
        height: leadingTight,
        color: textColor,
      ),
      titleMedium: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textBase,
        fontWeight: FontWeight.w600,
        height: leadingNormal,
        color: textColor,
      ),
      titleSmall: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textSm,
        fontWeight: FontWeight.w600,
        height: leadingNormal,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textBase,
        fontWeight: FontWeight.w400,
        height: leadingNormal,
        color: textColor,
      ),
      bodyMedium: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textSm,
        fontWeight: FontWeight.w400,
        height: leadingNormal,
        color: textColor,
      ),
      bodySmall: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textXs,
        fontWeight: FontWeight.w400,
        height: leadingNormal,
        color: textColor,
      ),
      labelLarge: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textSm,
        fontWeight: FontWeight.w600,
        height: leadingNormal,
        color: textColor,
      ),
      labelSmall: TextStyle(
        fontFamily: fontFamilyBody,
        fontSize: textXs,
        fontWeight: FontWeight.w500,
        height: leadingNormal,
        color: textColor,
      ),
    );
  }
}
