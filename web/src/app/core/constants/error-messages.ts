/** Frontend-facing user error messages — centralized for consistency and easy updates */
export const ERROR_MSG = {
  // ─── Generic ───────────────────────────────────────────
  GENERIC: 'Something went wrong. Please try again.',

  // ─── Auth ──────────────────────────────────────────────
  LOGIN_FAILED: 'Login failed. Please check your credentials.',
  REGISTER_FAILED: 'Registration failed. Please try again.',
  VERIFICATION_LOAD_FAILED: 'Failed to load verification status.',
  VERIFICATION_SUBMIT_FAILED: 'Failed to submit verification request.',
  VERIFICATION_APPROVE_FAILED: 'Failed to approve verification.',
  VERIFICATION_REJECT_FAILED: 'Failed to reject verification.',
  VERIFICATIONS_LOAD_FAILED: 'Failed to load verification requests.',

  // ─── Listings ──────────────────────────────────────────
  LISTING_LOAD_FAILED: 'Failed to load listing.',
  LISTING_CREATE_FAILED: 'Failed to create listing. Please try again.',
  LISTING_UPDATE_FAILED: 'Failed to update listing.',
  LISTING_NOT_FOUND: 'Listing not found.',
  PENDING_LISTINGS_LOAD_FAILED: 'Failed to load pending listings. Please try again.',

  // ─── Favorites ─────────────────────────────────────────
  FAVORITES_LOAD_FAILED: 'Failed to load favorites. Please try again.',

  // ─── Messaging ─────────────────────────────────────────
  CONVERSATIONS_LOAD_FAILED: 'Failed to load conversations.',
  CONVERSATION_START_FAILED: 'Unable to start conversation. Please try again.',

  // ─── Packages ──────────────────────────────────────────
  PACKAGES_LOAD_FAILED: 'Failed to load packages. Please try again.',
  PACKAGE_DETAILS_LOAD_FAILED: 'Failed to load package details.',
  MY_PACKAGES_LOAD_FAILED: 'Failed to load your packages. Please try again.',
  PACKAGE_CREATE_FAILED: 'Failed to create package.',
  PACKAGE_UPDATE_FAILED: 'Failed to update package.',
  PURCHASES_LOAD_FAILED: 'Failed to load purchases.',
  PURCHASE_REFUND_FAILED: 'Failed to refund this purchase. Please try again.',
  PURCHASE_CONFIRM_FAILED: 'Failed to confirm this payment. It may already have been confirmed.',

  // ─── Reviews ───────────────────────────────────────────
  REVIEWS_LOAD_FAILED: 'Failed to load reviews. Please try again.',
  REVIEW_SUBMIT_FAILED: 'Failed to submit review. Please try again.',

  // ─── Shorts ────────────────────────────────────────────
  SHORT_LOAD_FAILED: 'Failed to load short video.',
  SHORT_UPDATE_FAILED: 'Failed to update short. Please try again.',

  // ─── Profile ───────────────────────────────────────────
  PROFILE_LOAD_FAILED: 'Failed to load profile.',
  PROFILE_UPDATE_FAILED: 'Failed to update profile.',
  NOTIFICATION_PREFS_LOAD_FAILED: 'Failed to load notification preferences.',
  NOTIFICATION_PREFS_UPDATE_FAILED: 'Failed to update preference.',

  // ─── Admin ─────────────────────────────────────────────
  CATEGORIES_LOAD_FAILED: 'Failed to load categories. Please try again.',
  CATEGORY_CREATE_FAILED: 'Failed to create category.',
  CATEGORY_UPDATE_FAILED: 'Failed to update category.',
  CATEGORY_DELETE_FAILED: 'Failed to delete category.',
  CATEGORY_DELETE_IMPACT_FAILED: 'Could not check what this delete would affect.',
  CATEGORY_REORDER_FAILED: 'Failed to reorder.',
  ATTRIBUTE_CREATE_FAILED: 'Failed to create attribute definition.',
  ATTRIBUTE_UPDATE_FAILED: 'Failed to update attributes.',
  FEATURES_UPDATE_FAILED: 'Failed to update features.',
  USERS_LOAD_FAILED: 'Failed to load users. Please try again.',
  NOTIFICATIONS_LOAD_FAILED: 'Failed to load notifications.',
  NOTIFICATION_SEND_FAILED: 'Failed to send notification.',
  LOCATION_ADD_PROVINCE_FAILED: 'Failed to add province.',
  LOCATION_ADD_CITY_FAILED: 'Failed to add city.',
  LOCATION_ADD_AREA_FAILED: 'Failed to add area.',
  LOCATION_RENAME_FAILED: 'Failed to rename.',
  LOCATION_DELETE_FAILED: 'Failed to delete.',

  // ─── File Upload ───────────────────────────────────────
  DUPLICATE_IMAGE: 'Duplicate image detected. Each uploaded image must be unique.',
  INVALID_IMAGE_TYPE: 'Only JPEG and PNG images are allowed.',
  FILE_SIZE_EXCEEDED: 'File size must be less than 5MB.',
  INVALID_MAP_LINK: 'Please enter a valid Google Maps or Apple Maps link (https only)',
} as const;
