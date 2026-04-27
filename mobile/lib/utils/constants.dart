/// Application-wide constants.
class AppConstants {
  AppConstants._();

  // API
  static const String apiBaseUrl = 'http://localhost:3000/api';
  static const String wsBaseUrl = 'ws://localhost:3000';

  // Routes
  static const String packagesRoute = '/packages';
  static const String messagesRoute = '/messages';
  static const String createListingRoute = '/listings/create';

  // API endpoints
  static const String trackEndpoint = '/track';

  // Listing limits
  static const int maxImages = 20;
  static const int maxVideos = 1;
  static const int minMedia = 2;
  static const int maxTitleLength = 150;
  static const int maxDescriptionLength = 5000;
  static const int maxImageSizeMb = 5;
  static const int maxVideoSizeMb = 50;
  static const int defaultAdLimit = 10;

  // Pagination
  static const int defaultPageSize = 20;
  static const int messagesPageSize = 20;

  // Search
  static const int defaultSearchRadius = 25; // km
  static const int maxRecommendations = 20;

  // Review
  static const int maxReviewLength = 2000;
  static const int minRating = 1;
  static const int maxRating = 5;

  // Supported image formats
  static const List<String> supportedImageFormats = [
    'jpeg',
    'jpg',
    'png',
    'webp',
  ];

  // Supported video formats
  static const List<String> supportedVideoFormats = ['mp4'];

  // Category-Package Management tracking events
  static const String packageApply = 'package_apply';
  static const String packageListViewed = 'package_list_viewed';
  static const String packageConfirmModalShown = 'package_confirm_modal_shown';
  static const String packageConfirmModalConfirmed =
      'package_confirm_modal_confirmed';
  static const String packageConfirmModalCancelled =
      'package_confirm_modal_cancelled';
  static const String packageNoneAvailable = 'package_none_available';
  static const String packagePurchaseCtaClicked =
      'package_purchase_cta_clicked';
  static const String packagePurchaseInitiated = 'package_purchase_initiated';
  static const String myPackagesViewed = 'my_packages_viewed';
  static const String myPackagesFilterChanged = 'my_packages_filter_changed';
}
