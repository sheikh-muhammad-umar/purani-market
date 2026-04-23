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
  CATEGORY_FEATURES: (id: string) => `/categories/${id}/features`,

  // Brands (mobile)
  BRANDS: '/brands',
  BRAND_BY_ID: (id: string) => `/brands/${id}`,

  // Vehicle Brands
  VEHICLE_BRANDS: '/vehicle-brands',
  VEHICLE_BRAND_BY_ID: (id: string) => `/vehicle-brands/${id}`,

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
  PACKAGES_MY_PURCHASES: '/packages/my-purchases',

  // Messaging
  CONVERSATIONS: '/conversations',
  CONVERSATIONS_UNREAD_COUNT: '/conversations/unread-count',
  CONVERSATIONS_UNREAD_PER: '/conversations/unread-per-conversation',
  CONVERSATION_MESSAGES: (id: string) => `/conversations/${id}/messages`,
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
} as const;
