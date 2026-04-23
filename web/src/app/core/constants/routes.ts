/** Route path prefixes used for navigation and page detection */

export const ROUTES = {
  AUTH: '/auth/',
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_MFA: '/auth/mfa',
  MESSAGING: '/messaging',
  PROFILE: '/profile',
  PROFILE_SETTINGS: '/profile/settings',
  PROFILE_NOTIFICATIONS: '/profile/notifications',
  ADMIN: '/admin',
  SEARCH: '/search',
  LISTINGS: '/listings',
  LISTINGS_CREATE: '/listings/create',
  LISTINGS_MY: '/listings/my',
  FAVORITES: '/favorites',
  PACKAGES: '/packages',
  PACKAGES_MY: '/packages/my',
  CATEGORIES: '/categories',
  HOME: '/',

  // Static pages
  PAGES_ABOUT: '/pages/about',
  PAGES_CAREERS: '/pages/careers',
  PAGES_PRESS: '/pages/press',
  PAGES_TRUST_SAFETY: '/pages/trust-safety',
  PAGES_SELLING_TIPS: '/pages/selling-tips',
  PAGES_CONTACT: '/pages/contact',
  PAGES_TERMS: '/pages/terms',
  PAGES_PRIVACY: '/pages/privacy',
  PAGES_COOKIES: '/pages/cookies',
} as const;
