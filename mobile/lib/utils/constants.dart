/// Application-wide constants.
class AppConstants {
  AppConstants._();

  // API
  static const String apiBaseUrl = 'http://localhost:3000/api';
  static const String wsBaseUrl = 'ws://localhost:3000';

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
}
