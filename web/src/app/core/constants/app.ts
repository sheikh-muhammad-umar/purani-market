/** App-level constants */

export const DEFAULT_COUNTRY = 'Pakistan';

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

/** Currency */
export const DEFAULT_CURRENCY = 'PKR';
export const CURRENCY_SYMBOL = 'Rs';

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
