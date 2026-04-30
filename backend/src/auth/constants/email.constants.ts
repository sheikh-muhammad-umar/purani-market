/** Frontend route paths used in email links */
export const EMAIL_ROUTES = {
  VERIFY_EMAIL: '/verify-email',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL_CHANGE: '/verify-email-change',
} as const;

export const DEFAULT_FROM_ADDRESS = 'noreply@marketplace.com';
export const DEFAULT_FRONTEND_URL = 'http://localhost:4200';
export const BRAND_COLOR = process.env.BRAND_COLOR || '#4F46E5';
