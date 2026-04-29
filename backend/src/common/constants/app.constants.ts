/** App-level constants shared across the backend. */

// ─── Currency & Locale ──────────────────────────────────────
export const DEFAULT_CURRENCY = 'PKR';
export const DEFAULT_COUNTRY = 'Pakistan';

// ─── Cache ──────────────────────────────────────────────────
export const CACHE_KEY_CATEGORY_TREE = 'categories:tree';
export const CACHE_TTL_CATEGORY_TREE = 3600; // 1 hour
export const CACHE_TTL_POPULAR_SEARCHES = 3600; // 1 hour

// ─── View Deduplication ─────────────────────────────────────
export const VIEW_DEDUP_PREFIX = 'view';
export const VIEW_DEDUP_WINDOW_SECONDS = 1800; // 30 minutes

// ─── Listing Lifecycle ──────────────────────────────────────
export const LISTING_EXPIRY_REMINDER_DAYS = [3, 1];
export const PACKAGE_EXPIRY_REMINDER_DAYS = [3, 1];
export const FEATURED_EXPIRY_REMINDER_DAYS = [3, 1];
export const STALE_PENDING_PAYMENT_HOURS = 24;
export const STALE_RESERVED_DAYS = 14;
export const MAX_REJECTION_COUNT = 3;
export const STALE_PENDING_REVIEW_DAYS = 7; // days before auto-approving pending ads

// ─── Auto-Deletion Reasons ──────────────────────────────────
export const DELETION_REASON_INACTIVE_CLEANUP =
  'Auto-removed after 7 days of inactivity';
export const DELETION_REASON_MAX_REJECTIONS =
  'Auto-removed: max rejections reached with no resubmission';

// ─── ID Verification ────────────────────────────────────────
export const ID_VERIFICATION_AUTO_EXPIRE_REASON =
  'Auto-expired: verification was not reviewed within 30 days. Please resubmit.';

// ─── Messaging ──────────────────────────────────────────────
export const INACTIVE_CONVERSATION_RETENTION_DAYS = 30;

// ─── Content Moderation ─────────────────────────────────────
export const PROHIBITED_WORDS: readonly string[] = [
  'spam',
  'scam',
  'fake',
  'fraud',
  'illegal',
  'hate',
  'violence',
  'abuse',
] as const;

// ─── Pagination Limits ──────────────────────────────────────
export const MAX_REVIEWS_PER_PAGE = 20;
export const MAX_FAVORITES_PER_PAGE = 50;
