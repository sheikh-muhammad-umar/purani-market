export const environment = {
  production: true,
  apiUrl: '/api',
  wsUrl: '/ws/messaging',
  apiKey: 'mk_live_a7f3b9c2e1d4f6a8b0c3e5d7f9a1b3c5',
  appStoreUrl: 'https://apps.apple.com/app/marketplace/id000000000',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.marketplace.app',
  appGalleryUrl: 'https://appgallery.huawei.com/app/C000000000',
  appBannerDismissDays: 1,

  // Locale
  defaultCountry: 'Pakistan',
  defaultCurrency: 'PKR',
  currencySymbol: 'Rs',

  // Package durations (days) — keep in sync with the backend PACKAGE_DURATIONS /
  // SHORTS_PACKAGE_DURATIONS / BUNDLE_PACKAGE_DURATIONS env vars
  packageDurations: [7, 15, 30],
  shortsPackageDurations: [7, 15, 30, 60, 90],
  /** All-in-one terms. Longer than single-purpose ads because they include shorts. */
  bundlePackageDurations: [7, 15, 30, 60, 90],

  // SEO
  seoBaseUrl: 'https://marketplace.pk',
  seoSiteName: 'marketplace.pk',

  // Social Login
  googleClientId: '',
  facebookAppId: '',
  appleClientId: '',
};
