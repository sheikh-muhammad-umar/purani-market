/** API endpoint path constants */

export const API = {
  // Tracking
  TRACK: '/track',

  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_SOCIAL_LOGIN: '/auth/social-login',
  AUTH_REFRESH_TOKEN: '/auth/refresh-token',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_VERIFY_PHONE: '/auth/verify-phone',
  AUTH_RESEND_VERIFICATION: '/auth/resend-verification',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_MFA_ENABLE: '/auth/mfa/enable',
  AUTH_MFA_VERIFY: '/auth/mfa/verify',
  AUTH_CHANGE_PHONE: '/auth/change-phone',
  AUTH_CHANGE_PHONE_VERIFY: '/auth/change-phone/verify',

  // Users
  USERS_ME: '/users/me',

  // Listings
  LISTINGS: '/listings',
  LISTINGS_FEATURED: '/listings/featured',
  LISTING_BY_ID: (id: string) => `/listings/${id}`,
  LISTING_MEDIA: (id: string) => `/listings/${id}/media`,
  LISTING_FEATURE: (id: string) => `/listings/${id}/feature`,
  LISTING_STATUS: (id: string) => `/listings/${id}/status`,
  LISTING_RESUBMIT: (id: string) => `/listings/${id}/resubmit`,

  // Categories
  CATEGORIES: '/categories',
  CATEGORY_BY_ID: (id: string) => `/categories/${id}`,
  CATEGORY_INHERITED_ATTRS: (id: string) => `/categories/${id}/inherited-attributes`,
  CATEGORY_ATTRIBUTES: (id: string) => `/categories/${id}/attributes`,
  CATEGORY_ASSIGN_ATTRIBUTES: (id: string) => `/categories/${id}/assign-attributes`,
  CATEGORY_FEATURES: (id: string) => `/categories/${id}/features`,

  // Attribute Definitions
  ATTRIBUTE_DEFINITIONS: '/attribute-definitions',
  ATTRIBUTE_DEFINITIONS_SEARCH: '/attribute-definitions/search',
  ATTRIBUTE_DEFINITION_BY_ID: (id: string) => `/attribute-definitions/${id}`,

  // Brands (mobile)
  BRANDS: '/brands',
  BRAND_BY_ID: (id: string) => `/brands/${id}`,

  // Vehicle Brands
  VEHICLE_BRANDS: '/vehicle-brands',
  VEHICLE_BRAND_BY_ID: (id: string) => `/vehicle-brands/${id}`,
  VEHICLE_BRAND_CHECK_CATEGORY: (categoryId: string) =>
    `/vehicle-brands/check-category/${categoryId}`,

  // Vehicle Models
  VEHICLE_MODELS: '/vehicle-models',
  VEHICLE_MODELS_BULK: '/vehicle-models/bulk',
  VEHICLE_MODEL_BY_ID: (id: string) => `/vehicle-models/${id}`,

  // Vehicle Variants
  VEHICLE_VARIANTS: '/vehicle-variants',
  VEHICLE_VARIANTS_BULK: '/vehicle-variants/bulk',
  VEHICLE_VARIANT_BY_ID: (id: string) => `/vehicle-variants/${id}`,

  // Search
  SEARCH: '/search',
  SEARCH_SUGGESTIONS: '/search/suggestions',

  // Favorites
  FAVORITES: '/favorites',
  FAVORITE_BY_ID: (id: string) => `/favorites/${id}`,

  // Packages
  PACKAGES: '/packages',
  PACKAGE_BY_ID: (id: string) => `/packages/${id}`,
  PACKAGES_PURCHASE: '/packages/purchase',
  PACKAGES_AVAILABLE: '/packages/available',
  PACKAGES_MY_PURCHASES: '/packages/my-purchases',

  // Messaging
  CONVERSATIONS: '/conversations',
  CONVERSATIONS_UNREAD_COUNT: '/conversations/unread-count',
  CONVERSATIONS_UNREAD_PER: '/conversations/unread-per-conversation',
  CONVERSATION_MESSAGES: (id: string) => `/conversations/${id}/messages`,
  CONVERSATION_MESSAGES_IMAGE: (id: string) => `/conversations/${id}/messages/image`,
  CONVERSATION_MESSAGES_VOICE: (id: string) => `/conversations/${id}/messages/voice`,
  CONVERSATION_READ: (id: string) => `/conversations/${id}/read`,

  // Reviews
  REVIEWS: '/reviews',
  REVIEWS_BY_LISTING: (id: string) => `/reviews/listing/${id}`,
  REVIEWS_BY_SELLER: (id: string) => `/reviews/seller/${id}`,

  // Location
  LOCATION_PROVINCES: '/location/provinces',
  LOCATION_CITIES: (provinceId: string) => `/location/provinces/${provinceId}/cities`,
  LOCATION_AREAS: (cityId: string) => `/location/cities/${cityId}/areas`,
  LOCATION_NEARBY: '/location/nearby',

  // Recommendations
  RECOMMENDATIONS: '/recommendations',
  RECOMMENDATIONS_DISMISS: '/recommendations/dismiss',

  // Admin
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_BY_ID: (id: string) => `/admin/users/${id}`,
  ADMIN_USER_STATUS: (id: string) => `/admin/users/${id}/status`,
  ADMIN_USER_ROLE: (id: string) => `/admin/users/${id}/role`,
  ADMIN_USER_AD_LIMIT: (id: string) => `/admin/users/${id}/ad-limit`,
  ADMIN_USER_PERMISSIONS: (id: string) => `/admin/users/${id}/permissions`,
  ADMIN_USER_ACTIVITY: (id: string) => `/admin/users/${id}/activity`,
  ADMIN_ACTIVITY: '/admin/activity',
  ADMIN_PERMISSIONS: '/admin/permissions',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_ANALYTICS_EXPORT: '/admin/analytics/export',
  ADMIN_ANALYTICS_APP_BANNER: '/admin/analytics/app-banner',
  ADMIN_ANALYTICS_ENGAGEMENT: '/admin/analytics/engagement',
  ADMIN_ANALYTICS_PRICE_TRENDS: '/admin/analytics/price-trends',
  ADMIN_LISTINGS_PENDING: '/admin/listings/pending',
  ADMIN_LISTINGS_ALL: '/admin/listings/all',
  ADMIN_LISTING_APPROVE: (id: string) => `/admin/listings/${id}/approve`,
  ADMIN_LISTING_REJECT: (id: string) => `/admin/listings/${id}/reject`,
  ADMIN_REJECTION_REASONS: '/admin/rejection-reasons',
  ADMIN_REJECTION_REASON_BY_ID: (id: string) => `/admin/rejection-reasons/${id}`,
  ADMIN_DELETION_REASONS: '/admin/deletion-reasons',
  ADMIN_DELETION_REASON_BY_ID: (id: string) => `/admin/deletion-reasons/${id}`,
  ADMIN_PACKAGES_PURCHASES: '/admin/packages/purchases',
  ADMIN_PAYMENTS: '/admin/payments',
  ADMIN_SELLER_AD_INFO: (id: string) => `/admin/sellers/${id}/ad-info`,
  ADMIN_ID_VERIFICATION_STATS: '/admin/id-verification-stats',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  ADMIN_NOTIFICATIONS_SEND: '/admin/notifications/send',
  ADMIN_NOTIFICATION_BY_ID: (id: string) => `/admin/notifications/${id}`,

  // User Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',

  // ID Verification
  ID_VERIFICATION_SUBMIT: '/id-verification/submit',
  ID_VERIFICATION_MY_STATUS: '/id-verification/my-status',
  ID_VERIFICATION_ADMIN_PENDING: '/id-verification/admin/pending',
  ID_VERIFICATION_ADMIN_ALL: '/id-verification/admin/all',
  ID_VERIFICATION_ADMIN_DETAIL: (id: string) => `/id-verification/admin/${id}`,
  ID_VERIFICATION_ADMIN_REVIEW: (id: string) => `/id-verification/admin/${id}/review`,
  // SEO
  SEO_LISTING: (id: string) => `/seo/listing/${id}`,
  SEO_CATEGORY: (slug: string) => `/seo/category/${slug}`,
  SEO_SELLER: (id: string) => `/seo/seller/${id}`,
  SEO_HOME: '/seo/home',
  SEO_SEARCH: '/seo/search',
  SEO_PAGE: (slug: string) => `/seo/page/${slug}`,
} as const;
