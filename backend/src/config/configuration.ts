export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',

  // ─── Locale & Branding ──────────────────────────────────────
  locale: {
    currency: process.env.DEFAULT_CURRENCY || 'PKR',
    country: process.env.DEFAULT_COUNTRY || 'Pakistan',
    countryCode: process.env.DEFAULT_COUNTRY_CODE || 'PK',
  },

  branding: {
    color: process.env.BRAND_COLOR || '#4F46E5',
    mfaIssuer: process.env.MFA_ISSUER || 'OnlineMarketplace',
  },

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME || undefined,
    password: process.env.ELASTICSEARCH_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '900000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },

  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200',
  },

  seo: {
    baseUrl: process.env.SEO_BASE_URL || 'https://marketplace.pk',
    siteName: process.env.SEO_SITE_NAME || 'marketplace.pk',
    orgDescription:
      process.env.SEO_ORG_DESCRIPTION ||
      "Pakistan's trusted online marketplace for buying and selling new and used products.",
    robotsCrawlDelay: parseInt(process.env.ROBOTS_CRAWL_DELAY || '1', 10),
  },

  // ─── Listing Lifecycle ────────────────────────────────────────
  lifecycle: {
    stalePendingPaymentHours: parseInt(
      process.env.STALE_PENDING_PAYMENT_HOURS || '24',
      10,
    ),
    staleReservedDays: parseInt(process.env.STALE_RESERVED_DAYS || '14', 10),
    maxRejectionCount: parseInt(process.env.MAX_REJECTION_COUNT || '3', 10),
    stalePendingReviewDays: parseInt(
      process.env.STALE_PENDING_REVIEW_DAYS || '7',
      10,
    ),
    viewDedupWindowSeconds: parseInt(
      process.env.VIEW_DEDUP_WINDOW_SECONDS || '1800',
      10,
    ),
    inactiveConversationRetentionDays: parseInt(
      process.env.INACTIVE_CONVERSATION_RETENTION_DAYS || '30',
      10,
    ),
  },

  // ─── Pagination ───────────────────────────────────────────────
  pagination: {
    maxReviewsPerPage: parseInt(process.env.MAX_REVIEWS_PER_PAGE || '20', 10),
    maxFavoritesPerPage: parseInt(
      process.env.MAX_FAVORITES_PER_PAGE || '50',
      10,
    ),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
  },

  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKey: (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  apiKey: process.env.API_KEY || '',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@marketplace.com',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },

  listing: {
    activeDays: parseInt(process.env.LISTING_ACTIVE_DAYS || '30', 10),
    deactivatedCleanupDays: parseInt(
      process.env.LISTING_DEACTIVATED_CLEANUP_DAYS || '7',
      10,
    ),
    defaultAdLimit: parseInt(process.env.DEFAULT_AD_LIMIT || '10', 10),
  },

  review: {
    stalePendingModerationDays: parseInt(
      process.env.STALE_PENDING_REVIEW_MODERATION_DAYS || '14',
      10,
    ),
  },

  idVerification: {
    staleVerificationDays: parseInt(
      process.env.STALE_ID_VERIFICATION_DAYS || '30',
      10,
    ),
  },

  payments: {
    jazzcash: {
      merchantId: process.env.JAZZCASH_MERCHANT_ID || '',
      password: process.env.JAZZCASH_PASSWORD || '',
      integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || '',
      baseUrl:
        process.env.JAZZCASH_BASE_URL ||
        'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/',
      returnUrl:
        process.env.JAZZCASH_RETURN_URL ||
        'http://localhost:3000/api/packages/payment-callback',
    },
    easypaisa: {
      storeId: process.env.EASYPAISA_STORE_ID || '',
      hashKey: process.env.EASYPAISA_HASH_KEY || '',
      baseUrl:
        process.env.EASYPAISA_BASE_URL ||
        'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
      returnUrl:
        process.env.EASYPAISA_RETURN_URL ||
        'http://localhost:3000/api/packages/payment-callback',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      successUrl:
        process.env.STRIPE_SUCCESS_URL ||
        'http://localhost:4200/packages/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl:
        process.env.STRIPE_CANCEL_URL ||
        'http://localhost:4200/packages/cancel',
    },
  },
});
