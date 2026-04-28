/** App-level constants shared across the backend */

// Currency
export const DEFAULT_CURRENCY = 'PKR';

// Cache
export const CACHE_KEY_CATEGORY_TREE = 'categories:tree';
export const CACHE_TTL_CATEGORY_TREE = 3600; // 1 hour
export const CACHE_TTL_POPULAR_SEARCHES = 3600; // 1 hour

// View deduplication
export const VIEW_DEDUP_PREFIX = 'view';
export const VIEW_DEDUP_WINDOW_SECONDS = 1800; // 30 minutes

// Country
export const DEFAULT_COUNTRY = 'Pakistan';

// Listing lifecycle (fallback defaults — prefer ConfigService values from env)
export const LISTING_ACTIVE_DAYS = 30;
export const LISTING_DEACTIVATED_CLEANUP_DAYS = 7;
export const DEFAULT_AD_LIMIT = 10;
export const LISTING_EXPIRY_REMINDER_DAYS = [3, 1]; // days before expiry to send reminders
export const PACKAGE_EXPIRY_REMINDER_DAYS = [3, 1];
export const FEATURED_EXPIRY_REMINDER_DAYS = [3, 1];
export const STALE_PENDING_PAYMENT_HOURS = 24;
export const STALE_RESERVED_DAYS = 14;
export const MAX_REJECTION_COUNT = 3;
export const STALE_PENDING_REVIEW_DAYS = 7; //days before auto-approving peending ads

// Auto-deletion reasons
export const DELETION_REASON_INACTIVE_CLEANUP =
  'Auto-removed after 7 days of inactivity';
export const DELETION_REASON_MAX_REJECTIONS =
  'Auto-removed: max rejections reached with no resubmission';
