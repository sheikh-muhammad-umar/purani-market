/** All user activity tracking event types */
export type UserAction =
  // Browsing
  | 'view'
  | 'search'
  | 'category_browse'
  | 'page_view'

  // Engagement
  | 'favorite'
  | 'unfavorite'
  | 'contact'
  | 'share'

  // Listing actions
  | 'listing_create'
  | 'listing_edit'
  | 'listing_delete'
  | 'listing_status_change'
  | 'listing_feature'

  // Auth
  | 'login'
  | 'register'
  | 'logout'

  // Messaging
  | 'message_sent'
  | 'conversation_start'

  // Payments
  | 'package_purchase'
  | 'payment_attempt'

  // Location
  | 'location_change'

  // AI / Recommendations
  | 'dismiss'
  | 'recommendation_click'

  // App Banner
  | 'app_banner_shown'
  | 'app_banner_click'
  | 'app_banner_dismiss';
