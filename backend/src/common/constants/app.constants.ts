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
export const VIEW_DEDUP_WINDOW_SECONDS = parseInt(
  process.env.VIEW_DEDUP_WINDOW_SECONDS || '1800',
  10,
);

// ─── Listing Lifecycle ──────────────────────────────────────
export const LISTING_EXPIRY_REMINDER_DAYS = [3, 1];
export const PACKAGE_EXPIRY_REMINDER_DAYS = [3, 1];
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
export const CACHE_KEY_SEO_CATEGORY = 'seo:category:';
export const CACHE_KEY_SEO_SELLER = 'seo:seller:';
export const CACHE_KEY_SEO_HOME = 'seo:home';
export const CACHE_TTL_SEO_LISTING = 300; // 5 minutes
export const CACHE_TTL_SEO_CATEGORY = 1800; // 30 minutes
export const CACHE_TTL_SEO_SELLER = 1800; // 30 minutes
export const CACHE_TTL_SEO_HOME = 3600; // 1 hour
export const CACHE_KEY_SEO_SEARCH = 'seo:search:';
export const CACHE_KEY_SEO_PAGE = 'seo:page:';
export const CACHE_TTL_SEO_SEARCH = 600; // 10 minutes
export const CACHE_TTL_SEO_PAGE = 86400; // 24 hours

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
export const SEO_SUPPORTED_LANGUAGES = ['English', 'Urdu'] as const;
export const SEO_HREFLANG_VALUES = ['en', 'ur', 'x-default'] as const;
export const SEO_CATEGORY_PAGE_SIZE = 20;
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
} as const;

/** Robots.txt crawl directives. */
export const ROBOTS_ALLOWED_PATHS = [
  '/',
  '/listings/',
  '/categories/',
  '/seller/',
  '/search',
  '/pages/',
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
