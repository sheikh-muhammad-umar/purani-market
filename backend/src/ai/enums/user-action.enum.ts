export enum UserAction {
  /**
   * First event of a browser session. Carries the device, referrer and location
   * context once, so every later event in the session only needs to carry the
   * session id rather than repeating all of it.
   */
  SESSION_START = 'session_start',

  // Browsing
  VIEW = 'view',
  SEARCH = 'search',
  CATEGORY_BROWSE = 'category_browse',
  PAGE_VIEW = 'page_view',
  SELLER_PROFILE_VIEW = 'seller_profile_view',

  // Engagement
  FAVORITE = 'favorite',
  UNFAVORITE = 'unfavorite',
  CONTACT = 'contact',
  SHARE = 'share',
  FILTER_APPLY = 'filter_apply',
  /**
   * An advertisement was clicked. Billing counts live in `ad_events`; this copy
   * puts the click in the behavioural timeline so it can be read alongside what
   * the visitor did next.
   */
  AD_CLICK = 'ad_click',

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
  SOCIAL_LOGIN = 'social_login',

  // OTP / Verification
  OTP_SENT = 'otp_sent',
  OTP_VERIFIED = 'otp_verified',
  OTP_FAILED = 'otp_failed',
  OTP_RESENT = 'otp_resent',
  OTP_EXPIRED = 'otp_expired',
  EMAIL_VERIFIED = 'email_verified',
  PHONE_VERIFIED = 'phone_verified',
  WHATSAPP_OTP_SENT = 'whatsapp_otp_sent',

  // Reviews
  REVIEW_CREATE = 'review_create',

  // Messaging
  MESSAGE_SENT = 'message_sent',
  CONVERSATION_START = 'conversation_start',

  // Payments
  PACKAGE_PURCHASE = 'package_purchase',
  PAYMENT_ATTEMPT = 'payment_attempt',

  // Package management (frontend)
  PACKAGE_APPLY = 'package_apply',
  PACKAGE_LIST_VIEWED = 'package_list_viewed',
  PACKAGE_CONFIRM_MODAL_SHOWN = 'package_confirm_modal_shown',
  PACKAGE_CONFIRM_MODAL_CONFIRMED = 'package_confirm_modal_confirmed',
  PACKAGE_CONFIRM_MODAL_CANCELLED = 'package_confirm_modal_cancelled',
  PACKAGE_NONE_AVAILABLE = 'package_none_available',
  PACKAGE_PURCHASE_CTA_CLICKED = 'package_purchase_cta_clicked',
  PACKAGE_PURCHASE_INITIATED = 'package_purchase_initiated',
  MY_PACKAGES_VIEWED = 'my_packages_viewed',
  MY_PACKAGES_FILTER_CHANGED = 'my_packages_filter_changed',

  // Location
  LOCATION_CHANGE = 'location_change',

  // Voice Search
  VOICE_SEARCH_START = 'voice_search_start',
  VOICE_SEARCH_COMPLETE = 'voice_search_complete',
  VOICE_SEARCH_CANCEL = 'voice_search_cancel',
  VOICE_SEARCH_ERROR = 'voice_search_error',

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
  ADMIN_USER_LISTING_LIMIT_CHANGE = 'admin_user_listing_limit_change',
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
  ADMIN_PACKAGE_REFUND = 'admin_package_refund',
  LISTING_LIMIT_EXCEEDED = 'listing_limit_exceeded',
  LISTINGS_DEACTIVATED_FOR_LIMIT = 'listings_deactivated_for_limit',
  ADMIN_EXPORT_REPORT = 'admin_export_report',
  ADMIN_NOTIFICATION_SEND = 'admin_notification_send',
  ADMIN_REJECTION_REASON_CREATE = 'admin_rejection_reason_create',
  ADMIN_REJECTION_REASON_UPDATE = 'admin_rejection_reason_update',
  ADMIN_REJECTION_REASON_DELETE = 'admin_rejection_reason_delete',

  // Advertising inventory
  ADMIN_ADVERTISER_CREATE = 'admin_advertiser_create',
  ADMIN_ADVERTISER_UPDATE = 'admin_advertiser_update',
  ADMIN_ADVERTISER_DELETE = 'admin_advertiser_delete',
  ADMIN_AD_CAMPAIGN_CREATE = 'admin_ad_campaign_create',
  ADMIN_AD_CAMPAIGN_UPDATE = 'admin_ad_campaign_update',
  ADMIN_AD_CAMPAIGN_DELETE = 'admin_ad_campaign_delete',
  ADMIN_AD_CREATIVE_CREATE = 'admin_ad_creative_create',
  ADMIN_AD_CREATIVE_UPDATE = 'admin_ad_creative_update',
  ADMIN_AD_CREATIVE_DELETE = 'admin_ad_creative_delete',

  // ID Verification
  ID_VERIFICATION_SUBMIT = 'id_verification_submit',
  ADMIN_ID_VERIFICATION_APPROVE = 'admin_id_verification_approve',
  ADMIN_ID_VERIFICATION_REJECT = 'admin_id_verification_reject',

  // Package application
  PACKAGE_APPLY_SUCCESS = 'package_apply_success',
  PACKAGE_APPLY_FAILED = 'package_apply_failed',
  PACKAGE_EXPIRED = 'package_expired',

  // Packaged listing lifecycle
  PACKAGED_LISTING_DELETED = 'packaged_listing_deleted',
  PACKAGED_LISTING_DEACTIVATED = 'packaged_listing_deactivated',
  PACKAGED_LISTING_SOLD = 'packaged_listing_sold',

  // Listing lifecycle
  LISTING_EXPIRED = 'listing_expired',
  LISTING_DEACTIVATED_CLEANUP = 'listing_deactivated_cleanup',
  AD_SLOTS_PACKAGE_EXPIRED = 'ad_slots_package_expired',
  STALE_PAYMENT_FAILED = 'stale_payment_failed',

  // Shorts
  SHORT_UPLOADED = 'short_uploaded',
  SHORT_APPROVED = 'short_approved',
  SHORT_REJECTED = 'short_rejected',
  SHORT_EXPIRED = 'short_expired',
  SHORT_DELETED = 'short_deleted',
  SHORT_VIEWED = 'short_viewed',
  SHORT_VIEW = 'short_view',
  SHORT_UPLOAD_START = 'short_upload_start',
  SHORT_UPLOAD_SUCCESS = 'short_upload_success',
  SHORT_UPLOAD_FAIL = 'short_upload_fail',
  SHORT_EDIT = 'short_edit',
  SHORT_DELETE = 'short_delete',
  SHORT_LIKE = 'short_like',
  SHORT_UNLIKE = 'short_unlike',
  SHORT_CHAT_CLICK = 'short_chat_click',
  SHORT_CALL_CLICK = 'short_call_click',
  SHORT_SELLER_CLICK = 'short_seller_click',
  SHORT_FEED_FILTER = 'short_feed_filter',
  SHORT_SHARE = 'short_share',
  SHORT_PACKAGE_VIEW = 'short_package_view',
  SHORT_PACKAGE_PURCHASE = 'short_package_purchase',
  SHORT_CAMERA_RECORD = 'short_camera_record',
  SHORT_LIMIT_REACHED = 'short_limit_reached',
  SHORTS_PACKAGE_PURCHASED = 'shorts_package_purchased',
  SHORTS_PACKAGE_EXPIRED = 'shorts_package_expired',
}
