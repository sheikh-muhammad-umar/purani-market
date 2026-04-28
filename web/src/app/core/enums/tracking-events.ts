/** All user activity tracking event constants */
export const TrackingEvent = {
  // Browsing
  VIEW: 'view',
  SEARCH: 'search',
  CATEGORY_BROWSE: 'category_browse',
  PAGE_VIEW: 'page_view',

  // Engagement
  FAVORITE: 'favorite',
  UNFAVORITE: 'unfavorite',
  CONTACT: 'contact',
  SHARE: 'share',

  // Listing actions
  LISTING_CREATE: 'listing_create',
  LISTING_EDIT: 'listing_edit',
  LISTING_DELETE: 'listing_delete',
  LISTING_STATUS_CHANGE: 'listing_status_change',
  LISTING_FEATURE: 'listing_feature',
  LISTING_PRICE_CHANGE: 'listing_price_change',

  // Auth
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  REGISTER: 'register',
  LOGOUT: 'logout',
  SOCIAL_LOGIN: 'social_login',

  // OTP / Verification
  OTP_SENT: 'otp_sent',
  OTP_VERIFIED: 'otp_verified',
  OTP_FAILED: 'otp_failed',
  OTP_RESENT: 'otp_resent',
  EMAIL_VERIFIED: 'email_verified',
  PHONE_VERIFIED: 'phone_verified',

  // Messaging
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_START: 'conversation_start',

  // Payments
  PACKAGE_PURCHASE: 'package_purchase',
  PAYMENT_ATTEMPT: 'payment_attempt',

  // Category-Package Management
  PACKAGE_APPLY: 'package_apply',
  PACKAGE_LIST_VIEWED: 'package_list_viewed',
  PACKAGE_CONFIRM_MODAL_SHOWN: 'package_confirm_modal_shown',
  PACKAGE_CONFIRM_MODAL_CONFIRMED: 'package_confirm_modal_confirmed',
  PACKAGE_CONFIRM_MODAL_CANCELLED: 'package_confirm_modal_cancelled',
  PACKAGE_NONE_AVAILABLE: 'package_none_available',
  PACKAGE_PURCHASE_CTA_CLICKED: 'package_purchase_cta_clicked',
  PACKAGE_PURCHASE_INITIATED: 'package_purchase_initiated',
  MY_PACKAGES_VIEWED: 'my_packages_viewed',
  MY_PACKAGES_FILTER_CHANGED: 'my_packages_filter_changed',

  // Location
  LOCATION_CHANGE: 'location_change',

  // AI / Recommendations
  DISMISS: 'dismiss',
  RECOMMENDATION_CLICK: 'recommendation_click',

  // App Banner
  APP_BANNER_SHOWN: 'app_banner_shown',
  APP_BANNER_CLICK: 'app_banner_click',
  APP_BANNER_DISMISS: 'app_banner_dismiss',
} as const;

/** Union type derived from the const object */
export type UserAction = (typeof TrackingEvent)[keyof typeof TrackingEvent];

/** Actions that should be tracked for anonymous/guest users */
export const ANONYMOUS_TRACKED_ACTIONS = new Set<UserAction>([
  TrackingEvent.VIEW,
  TrackingEvent.SEARCH,
  TrackingEvent.CATEGORY_BROWSE,
  TrackingEvent.PAGE_VIEW,
]);
