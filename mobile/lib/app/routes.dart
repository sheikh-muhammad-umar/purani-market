import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/home/home_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/verification_screen.dart';
import '../features/auth/mfa_screen.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/listings/listing_detail_screen.dart';
import '../features/listings/create_listing_screen.dart';
import '../features/listings/seller_dashboard_screen.dart';
import '../features/search/search_screen.dart';
import '../features/categories/categories_screen.dart';
import '../features/messaging/conversations_screen.dart';
import '../features/messaging/chat_window_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/profile/edit_profile_screen.dart';
import '../features/profile/settings_screen.dart';
import '../features/favorites/favorites_screen.dart';
import '../features/packages/packages_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/verification',
        builder: (context, state) {
          final extra = state.extra as Map<String, String>?;
          return VerificationScreen(
            phone: extra?['phone'],
            email: extra?['email'],
          );
        },
      ),
      GoRoute(
        path: '/mfa',
        builder: (context, state) => const MfaScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/search',
        builder: (context, state) => const SearchScreen(),
      ),
      GoRoute(
        path: '/categories',
        builder: (context, state) => const CategoriesScreen(),
      ),
      GoRoute(
        path: '/listings/:id',
        builder: (context, state) => ListingDetailScreen(
          listingId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/listings/create',
        builder: (context, state) => const CreateListingScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const SellerDashboardScreen(),
      ),
      GoRoute(
        path: '/messages',
        builder: (context, state) => const ConversationsScreen(),
      ),
      GoRoute(
        path: '/messages/:id',
        builder: (context, state) => ChatWindowScreen(
          conversationId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/favorites',
        builder: (context, state) => const FavoritesScreen(),
      ),
      GoRoute(
        path: '/packages',
        builder: (context, state) => const PackagesScreen(),
      ),
    ],
  );
});
