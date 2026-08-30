/**
 * All user activity tracking event constants.
 *
 * Every value here must also exist in the backend `UserAction` enum
 * (`src/ai/enums/user-action.enum.ts`). The `/track` DTO validates `action` with
 * `@IsEnum`, and the tracker swallows errors, so an action that is missing
 * server-side is rejected with a 400 that nothing surfaces — the event simply
 * never appears in analytics.
 */
export const TrackingEvent = {
  /** First event of a session; carries device, referrer and location context. */
  SESSION_START: 'session_start',

  // Browsing
  VIEW: 'view',
  SEARCH: 'search',
  CATEGORY_BROWSE: 'category_browse',
  PAGE_VIEW: 'page_view',
  SELLER_PROFILE_VIEW: 'seller_profile_view',

  // Engagement
  FAVORITE: 'favorite',
  UNFAVORITE: 'unfavorite',
  CONTACT: 'contact',
  SHARE: 'share',
  FILTER_APPLY: 'filter_apply',
  /**
   * An advertisement was clicked.
   *
   * Billing still lives in `ad_events`; this copy exists so an ad click appears
   * in the behavioural timeline next to what the visitor did afterwards.
   * Impressions are deliberately not mirrored here — see `ad-slot.component.ts`.
   */
  AD_CLICK: 'ad_click',

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

  // Voice Search
  VOICE_SEARCH_START: 'voice_search_start',
  VOICE_SEARCH_COMPLETE: 'voice_search_complete',
  VOICE_SEARCH_CANCEL: 'voice_search_cancel',
  VOICE_SEARCH_ERROR: 'voice_search_error',

  // AI / Recommendations
  DISMISS: 'dismiss',
  RECOMMENDATION_CLICK: 'recommendation_click',

  // App Banner
  APP_BANNER_SHOWN: 'app_banner_shown',
  APP_BANNER_CLICK: 'app_banner_click',
  APP_BANNER_DISMISS: 'app_banner_dismiss',

  // Shorts
  SHORT_VIEW: 'short_view',
  SHORT_UPLOAD_START: 'short_upload_start',
  SHORT_UPLOAD_SUCCESS: 'short_upload_success',
  SHORT_UPLOAD_FAIL: 'short_upload_fail',
  SHORT_EDIT: 'short_edit',
  SHORT_DELETE: 'short_delete',
  SHORT_LIKE: 'short_like',
  SHORT_UNLIKE: 'short_unlike',
  SHORT_CHAT_CLICK: 'short_chat_click',
  SHORT_CALL_CLICK: 'short_call_click',
  SHORT_SELLER_CLICK: 'short_seller_click',
  SHORT_FEED_FILTER: 'short_feed_filter',
  SHORT_SHARE: 'short_share',
  SHORT_PACKAGE_VIEW: 'short_package_view',
  SHORT_PACKAGE_PURCHASE: 'short_package_purchase',
  SHORT_CAMERA_RECORD: 'short_camera_record',
  SHORT_LIMIT_REACHED: 'short_limit_reached',
} as const;

/** Union type derived from the const object */
export type UserAction = (typeof TrackingEvent)[keyof typeof TrackingEvent];

/**
 * Actions that are tracked for anonymous visitors too.
 *
 * Guests are the bulk of marketplace traffic, so restricting this list to plain
 * browsing hid the funnel that matters: which listings guests contact, what they
 * filter by, and where they arrive from. Everything here is behavioural and
 * keyed on a session id rather than an identity.
 *
 * Deliberately excluded: `short_view`, which the shorts feed emits on every
 * slide change with no dwell time or de-duplication. Opening it to guests would
 * multiply write volume for the least considered event in the app.
 */
export const ANONYMOUS_TRACKED_ACTIONS = new Set<UserAction>([
  TrackingEvent.SESSION_START,
  TrackingEvent.VIEW,
  TrackingEvent.SEARCH,
  TrackingEvent.CATEGORY_BROWSE,
  TrackingEvent.PAGE_VIEW,
  TrackingEvent.SELLER_PROFILE_VIEW,
  TrackingEvent.FILTER_APPLY,
  TrackingEvent.CONTACT,
  TrackingEvent.SHARE,
  TrackingEvent.AD_CLICK,
  TrackingEvent.RECOMMENDATION_CLICK,
  TrackingEvent.VOICE_SEARCH_START,
  TrackingEvent.VOICE_SEARCH_COMPLETE,
  TrackingEvent.VOICE_SEARCH_CANCEL,
  TrackingEvent.VOICE_SEARCH_ERROR,
]);
