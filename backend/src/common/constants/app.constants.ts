/** App-level constants shared across the backend. */

// ═══════════════════════════════════════════════════════════════
// Values driven by environment variables — change in .env, not here.
// Every constant below reads from process.env with a sensible fallback
// so the app works out-of-the-box in development.
// ═══════════════════════════════════════════════════════════════

// ─── Currency & Locale ──────────────────────────────────────
export const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'PKR';
export const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || 'Pakistan';

// ─── SEO Shared ─────────────────────────────────────────────
export const SEO_BASE_URL =
  process.env.SEO_BASE_URL || 'https://marketplace.pk';
export const SEO_SITE_NAME = process.env.SEO_SITE_NAME || 'marketplace.pk';
export const SEO_PLACEHOLDER_IMAGE = `${SEO_BASE_URL}/assets/placeholder.png`;
export const SEO_LOGO_URL = `${SEO_BASE_URL}/assets/logo.png`;
export const SEO_OG_DEFAULT_IMAGE = `${SEO_BASE_URL}/assets/og-default.png`;
export const SEO_ORG_DESCRIPTION =
  process.env.SEO_ORG_DESCRIPTION ||
  "Pakistan's trusted online marketplace for buying and selling new and used products.";
export const SEO_DEFAULT_COUNTRY_CODE =
  process.env.DEFAULT_COUNTRY_CODE || 'PK';
export const ROBOTS_CRAWL_DELAY = parseInt(
  process.env.ROBOTS_CRAWL_DELAY || '1',
  10,
);

// ─── View Deduplication ─────────────────────────────────────
export const VIEW_DEDUP_PREFIX = 'view';

/**
 * How long before the same visitor can add another view to the same item.
 *
 * Repeat interest counts — somebody coming back to a car tomorrow is a stronger
 * signal than a single glance — but not within the hour, so holding refresh adds
 * nothing. One hour exactly, and the same figure for listings and shorts: shorts
 * previously counted every request, including the seller reloading their own
 * video, so the two numbers were not comparable.
 */
export const VIEW_DEDUP_WINDOW_SECONDS = parseInt(
  process.env.VIEW_DEDUP_WINDOW_SECONDS || '3600',
  10,
);

// ─── Listing Lifecycle ──────────────────────────────────────
export const LISTING_EXPIRY_REMINDER_DAYS = [3, 1];

/**
 * How close to expiry a listing counts as "expiring soon".
 *
 * Matched to the first expiry reminder, so the tab and the notification agree: a
 * seller who has just been emailed about an ad finds it under the same heading
 * when they come to look.
 */
export const LISTING_EXPIRING_SOON_DAYS = LISTING_EXPIRY_REMINDER_DAYS[0];
export const PACKAGE_EXPIRY_REMINDER_DAYS = [3, 1];

/**
 * How long a seller has to get back within their listing limit before the excess
 * is deactivated for them.
 *
 * Exists because ad slots expire under listings that are still running. Pulling
 * ads the moment the limit drops would take a seller's shopfront down without
 * warning; leaving them over the limit for ever makes the limit meaningless.
 */
/**
 * Timezone every scheduled job runs in.
 *
 * Without it `@Cron` follows the server clock, so a "9am reminder" arrives at
 * whatever 9am means on the host — and shifts if the host region changes. Sellers
 * read these as local times, so they are pinned to the reporting timezone.
 */
export const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Asia/Karachi';

export const LISTING_LIMIT_GRACE_DAYS = parseInt(
  process.env.LISTING_LIMIT_GRACE_DAYS || '7',
  10,
);
export const FEATURED_EXPIRY_REMINDER_DAYS = [3, 1];
export const STALE_PENDING_PAYMENT_HOURS = parseInt(
  process.env.STALE_PENDING_PAYMENT_HOURS || '24',
  10,
);
export const STALE_RESERVED_DAYS = parseInt(
  process.env.STALE_RESERVED_DAYS || '14',
  10,
);
export const MAX_REJECTION_COUNT = parseInt(
  process.env.MAX_REJECTION_COUNT || '3',
  10,
);

// ─── Reports / Moderation ───────────────────────────────────
/**
 * Upheld reports that trigger an automatic account suspension. Suspension fires
 * once the count reaches this value (i.e. the 3rd approved report).
 */
export const MAX_APPROVED_REPORTS = parseInt(
  process.env.MAX_APPROVED_REPORTS || '3',
  10,
);

/** How long an auto-suspension for exceeding the report threshold lasts. */
export const REPORT_SUSPENSION_MONTHS = parseInt(
  process.env.REPORT_SUSPENSION_MONTHS || '3',
  10,
);

/** Max screenshots a reporter may attach as evidence. */
export const MAX_REPORT_SCREENSHOTS = parseInt(
  process.env.MAX_REPORT_SCREENSHOTS || '5',
  10,
);

/** Max photos a reviewer may attach to a rating. */
export const MAX_REVIEW_IMAGES = parseInt(
  process.env.MAX_REVIEW_IMAGES || '2',
  10,
);
export const STALE_PENDING_REVIEW_DAYS = parseInt(
  process.env.STALE_PENDING_REVIEW_DAYS || '7',
  10,
);

// ─── Messaging ──────────────────────────────────────────────
export const INACTIVE_CONVERSATION_RETENTION_DAYS = parseInt(
  process.env.INACTIVE_CONVERSATION_RETENTION_DAYS || '30',
  10,
);

// ─── Pagination Limits ──────────────────────────────────────
export const MAX_REVIEWS_PER_PAGE = parseInt(
  process.env.MAX_REVIEWS_PER_PAGE || '20',
  10,
);
export const MAX_FAVORITES_PER_PAGE = parseInt(
  process.env.MAX_FAVORITES_PER_PAGE || '50',
  10,
);

// ═══════════════════════════════════════════════════════════════
// Structural constants — these are code-level and do NOT belong
// in .env (cache keys, route patterns, static enums, etc.)
// ═══════════════════════════════════════════════════════════════

// ─── Cache ──────────────────────────────────────────────────
export const CACHE_KEY_CATEGORY_TREE = 'categories:tree';
export const CACHE_TTL_CATEGORY_TREE = 3600; // 1 hour
export const CACHE_TTL_POPULAR_SEARCHES = 3600; // 1 hour

// ─── SEO Cache ──────────────────────────────────────────────
export const CACHE_KEY_SEO_LISTING = 'seo:listing:';
export const CACHE_KEY_SEO_SELLER = 'seo:seller:';
export const CACHE_KEY_SEO_HOME = 'seo:home';
export const CACHE_TTL_SEO_LISTING = 300; // 5 minutes
export const CACHE_TTL_SEO_SELLER = 1800; // 30 minutes
export const CACHE_TTL_SEO_HOME = 3600; // 1 hour
export const CACHE_KEY_SEO_SEARCH = 'seo:search:';
export const CACHE_KEY_SEO_PAGE = 'seo:page:';
export const CACHE_KEY_SEO_SHORT = 'seo:short:';
export const CACHE_TTL_SEO_SEARCH = 600; // 10 minutes
export const CACHE_TTL_SEO_PAGE = 86400; // 24 hours
export const CACHE_TTL_SEO_SHORT = 300; // 5 minutes

// ─── Sitemap Cache ──────────────────────────────────────────
export const CACHE_KEY_SITEMAP = 'seo:sitemap:';
export const CACHE_KEY_SITEMAP_INDEX = 'seo:sitemap:index';
export const CACHE_TTL_SITEMAP = 21600; // 6 hours
export const SITEMAP_MAX_URLS = 50000;

// ─── SEO Structural ─────────────────────────────────────────
export const SEO_DEFAULT_SLUG_FALLBACK = 'listing';
export const SEO_SELLER_FALLBACK_NAME = 'Seller';
export const SEO_DESCRIPTION_MAX_LENGTH = 160;
export const SEO_DEFAULT_OG_TYPE = 'website' as const;
/**
 * Languages advertised in the Organization schema's contact point. English only:
 * the platform has no Urdu UI, so claiming Urdu customer service was untrue.
 */
export const SEO_SUPPORTED_LANGUAGES = ['English'] as const;
/** Kept in step with the web copy in core/constants/seo.ts. */
export const SEO_HREFLANG_VALUES = ['en', 'x-default'] as const;
export const SEO_PRERENDER_HOME_TTL = 3600; // 1 hour
export const SEO_PRERENDER_STATIC_TTL = 86400; // 24 hours
export const SEO_PRERENDER_FETCH_TIMEOUT_MS = 30000;
export const SEO_PRERENDER_STALE_THRESHOLD_RATIO = 0.1;

/** Static page slugs used for sitemap generation and prerendering. */
export const SEO_STATIC_PAGES = [
  'about',
  'terms',
  'privacy',
  'contact',
  'careers',
  'press',
  'trust-safety',
  'selling-tips',
  'cookies',
] as const;

/** Route path patterns used by SlugService and robots.txt. */
export const SEO_ROUTE_PATTERNS = {
  LISTING: '/listings',
  CATEGORY: '/categories',
  SELLER: '/seller',
  SEARCH: '/search',
  PAGES: '/pages',
  SHORTS: '/shorts',
} as const;

/** Robots.txt crawl directives. */
export const ROBOTS_ALLOWED_PATHS = [
  '/',
  '/listings/',
  '/categories/',
  '/seller/',
  '/search',
  '/pages/',
  '/shorts/',
] as const;

export const ROBOTS_DISALLOWED_PATHS = [
  '/profile',
  '/favorites',
  '/messaging',
  '/admin',
  '/auth',
  '/listings/create',
  '/listings/my',
  '/listings/*/edit',
] as const;

// ─── Auto-Deletion Reasons ──────────────────────────────────
export const DELETION_REASON_INACTIVE_CLEANUP =
  'Auto-removed after 7 days of inactivity';
export const DELETION_REASON_MAX_REJECTIONS =
  'Auto-removed: max rejections reached with no resubmission';

// ─── ID Verification ────────────────────────────────────────
/**
 * How many ID verification submissions a user gets in total.
 *
 * Counts admin rejections only. A submission auto-expired by the cleanup cron was
 * never reviewed, so burning an attempt for it would penalise the user for the
 * backlog rather than for anything they did.
 */
export const MAX_ID_VERIFICATION_ATTEMPTS = 3;

export const ID_VERIFICATION_AUTO_EXPIRE_REASON =
  'Auto-expired: verification was not reviewed within 30 days. Please resubmit.';

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

// ─── Shorts ─────────────────────────────────────────────────
export const SHORTS_FREE_LIMIT = 3;
export const SHORTS_FREE_DURATION_DAYS = 7;
export const SHORTS_MAX_DURATION_SECONDS = 60;
export const SHORTS_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
export const SHORTS_EXPIRY_REMINDER_DAYS = [2, 1];

/**
 * Prefix for the reference stamped on a manually-paid purchase.
 *
 * Namespaced so it can never collide with a gateway transaction id, which is what
 * `handlePaymentCallback` matches purchases on.
 */
export const MANUAL_PAYMENT_REFERENCE_PREFIX = 'MANUAL-';
export const SHORTS_STALE_PENDING_REVIEW_DAYS = 3; // Auto-approve after 3 days

export const SHORTS_ALLOWED_MIMETYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const SHORTS_ACCEPT_STRING = 'video/mp4,video/webm,video/quicktime';
