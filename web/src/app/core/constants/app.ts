/** App-level constants */

import { environment } from '../../../environments/environment';

// ─── Values from environment (change in environment.ts, not here) ───
export const DEFAULT_COUNTRY = environment.defaultCountry;
export const DEFAULT_CURRENCY = environment.defaultCurrency;
export const CURRENCY_SYMBOL = environment.currencySymbol;

// ─── Structural constants ───────────────────────────────────

/** User-agent detection patterns */
export const UA_MOBILE_PATTERN = /android|iphone|ipad|ipod/i;
export const UA_HUAWEI_PATTERN = /huawei|hmscore/i;
export const UA_IOS_PATTERN = /iphone|ipad|ipod/i;

/** Platform identifiers */
export const PLATFORM_IOS = 'ios';
export const PLATFORM_ANDROID = 'android';
export const PLATFORM_HUAWEI = 'huawei';

/** Login method identifiers */
export const LOGIN_METHOD_EMAIL = 'email';
export const LOGIN_METHOD_PHONE = 'phone';

/** Chat quick replies */
export const QUICK_REPLIES = [
  'Is this still available?',
  "What's your best price?",
  'Can I see it today?',
  'Is the price negotiable?',
  'Can you share more photos?',
  'Where is the pickup location?',
  "I'm interested, let's discuss",
  'What condition is it in?',
];

/** Asset paths */
export const CATEGORY_ICONS_PATH = 'assets/category-icons';
export const PLACEHOLDER_IMAGE = 'assets/placeholder.png';
export const DEFAULT_CATEGORY_ICON = `${CATEGORY_ICONS_PATH}/default.jpg`;

/** Package type display labels */
export const PACKAGE_TYPE_LABELS: Record<string, string> = {
  featured_ads: 'Featured Ads',
  ad_slots: 'Ad Slots',
};

/** Payment method display config */
export const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: string }> = {
  jazzcash: { label: 'JazzCash', icon: 'smartphone' },
  easypaisa: { label: 'EasyPaisa', icon: 'account_balance_wallet' },
  card: { label: 'Credit/Debit Card', icon: 'credit_card' },
};

// ─── Pagination ─────────────────────────────────────────────
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_LARGE = 50;
export const FEATURED_ADS_LIMIT = 10;
export const NEARBY_LISTINGS_LIMIT = 12;

// ─── Geolocation ────────────────────────────────────────────
export const GEO_TIMEOUT_MS = 5000;
export const GEO_MAX_AGE_MS = 300_000; // 5 minutes

// ─── WebSocket ──────────────────────────────────────────────
export const WS_RECONNECTION_ATTEMPTS = 10;
export const WS_RECONNECTION_DELAY_MS = 1000;
