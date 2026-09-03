/**
 * Public-facing error messages returned to clients.
 * These are intentionally generic to avoid leaking internal details.
 * Each has a unique code for debugging/support purposes.
 */
export const PUBLIC_ERROR = {
  // Generic
  NOT_FOUND: {
    code: 'ERR_001',
    message: 'The requested resource was not found.',
  },
  BAD_REQUEST: { code: 'ERR_002', message: 'Unable to process your request.' },
  FORBIDDEN: {
    code: 'ERR_003',
    message: 'You do not have permission to perform this action.',
  },
  UNAUTHORIZED: { code: 'ERR_004', message: 'Authentication required.' },
  INTERNAL: {
    code: 'ERR_005',
    message: 'Something went wrong. Please try again later.',
  },
  CONFLICT: {
    code: 'ERR_006',
    message: 'This action has already been performed.',
  },

  // Reports
  REPORT_ALREADY_PENDING: {
    code: 'RPT_001',
    message: 'You already have a pending report for this.',
  },
  REPORT_ALREADY_REVIEWED: {
    code: 'RPT_002',
    message: 'This report has already been reviewed.',
  },

  // Messaging
  MESSAGING_FAILED: {
    code: 'MSG_001',
    message: 'Unable to start conversation.',
  },
  MESSAGING_SEND_FAILED: {
    code: 'MSG_002',
    message: 'Unable to send message.',
  },
  MESSAGING_NOT_ALLOWED: {
    code: 'MSG_003',
    message: 'Messaging is not available for this item.',
  },

  // Listings
  LISTING_ACTION_FAILED: {
    code: 'LST_001',
    message: 'Unable to perform this action on the listing.',
  },
  LISTING_UPLOAD_FAILED: { code: 'LST_002', message: 'Unable to upload file.' },

  // Payments
  PAYMENT_FAILED: {
    code: 'PAY_001',
    message: 'Payment could not be processed.',
  },
  PACKAGE_UNAVAILABLE: {
    code: 'PAY_002',
    message: 'This package is not available.',
  },

  // Auth
  AUTH_FAILED: { code: 'AUTH_001', message: 'Authentication failed.' },
  VERIFICATION_FAILED: {
    code: 'AUTH_002',
    message: 'Verification could not be processed.',
  },

  // Shorts
  SHORT_ACTION_FAILED: {
    code: 'SHT_001',
    message: 'Unable to perform this action.',
  },

  // Reviews
  REVIEW_FAILED: { code: 'REV_001', message: 'Unable to submit review.' },

  // Admin
  ADMIN_ACTION_FAILED: {
    code: 'ADM_001',
    message: 'Unable to perform this administrative action.',
  },

  // Categories
  CATEGORY_ACTION_FAILED: {
    code: 'CAT_001',
    message: 'Unable to perform this action on the category.',
  },

  // Brands
  BRAND_NOT_FOUND: {
    code: 'BRD_001',
    message: 'The requested resource was not found.',
  },

  // Favorites
  FAVORITE_ACTION_FAILED: {
    code: 'FAV_001',
    message: 'Unable to perform this action.',
  },

  // ID Verification
  ID_VERIFICATION_FAILED: {
    code: 'IDV_001',
    message: 'Unable to process verification request.',
  },
  ID_VERIFICATION_ATTEMPTS_EXHAUSTED: {
    code: 'IDV_002',
    message:
      'You have used all your ID verification attempts. Please contact support.',
  },

  // Users
  USER_NOT_FOUND: {
    code: 'USR_001',
    message: 'The requested resource was not found.',
  },
} as const;
