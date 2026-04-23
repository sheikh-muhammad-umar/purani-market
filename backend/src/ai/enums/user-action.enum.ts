export enum UserAction {
  // Browsing
  VIEW = 'view',
  SEARCH = 'search',
  CATEGORY_BROWSE = 'category_browse',
  PAGE_VIEW = 'page_view',

  // Engagement
  FAVORITE = 'favorite',
  UNFAVORITE = 'unfavorite',
  CONTACT = 'contact',
  SHARE = 'share',

  // Listing actions
  LISTING_CREATE = 'listing_create',
  LISTING_EDIT = 'listing_edit',
  LISTING_DELETE = 'listing_delete',
  LISTING_STATUS_CHANGE = 'listing_status_change',
  LISTING_FEATURE = 'listing_feature',
  LISTING_PRICE_CHANGE = 'listing_price_change',

  // Auth
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  REGISTER = 'register',
  LOGOUT = 'logout',

  // Messaging
  MESSAGE_SENT = 'message_sent',
  CONVERSATION_START = 'conversation_start',

  // Payments
  PACKAGE_PURCHASE = 'package_purchase',
  PAYMENT_ATTEMPT = 'payment_attempt',

  // Location
  LOCATION_CHANGE = 'location_change',

  // AI
  DISMISS = 'dismiss',
  RECOMMENDATION_CLICK = 'recommendation_click',

  // App Banner
  APP_BANNER_SHOWN = 'app_banner_shown',
  APP_BANNER_CLICK = 'app_banner_click',
  APP_BANNER_DISMISS = 'app_banner_dismiss',

  // Admin actions
  ADMIN_USER_STATUS_CHANGE = 'admin_user_status_change',
  ADMIN_USER_ROLE_CHANGE = 'admin_user_role_change',
  ADMIN_USER_AD_LIMIT_CHANGE = 'admin_user_ad_limit_change',
  ADMIN_LISTING_APPROVE = 'admin_listing_approve',
  ADMIN_LISTING_REJECT = 'admin_listing_reject',
  ADMIN_CATEGORY_CREATE = 'admin_category_create',
  ADMIN_CATEGORY_UPDATE = 'admin_category_update',
  ADMIN_CATEGORY_DELETE = 'admin_category_delete',
  ADMIN_CATEGORY_ATTRIBUTES_UPDATE = 'admin_category_attributes_update',
  ADMIN_CATEGORY_FEATURES_UPDATE = 'admin_category_features_update',
  ADMIN_LOCATION_CREATE = 'admin_location_create',
  ADMIN_LOCATION_UPDATE = 'admin_location_update',
  ADMIN_LOCATION_DELETE = 'admin_location_delete',
  ADMIN_PACKAGE_CREATE = 'admin_package_create',
  ADMIN_PACKAGE_UPDATE = 'admin_package_update',
  ADMIN_EXPORT_REPORT = 'admin_export_report',
  ADMIN_REJECTION_REASON_CREATE = 'admin_rejection_reason_create',
  ADMIN_REJECTION_REASON_UPDATE = 'admin_rejection_reason_update',
  ADMIN_REJECTION_REASON_DELETE = 'admin_rejection_reason_delete',
}
