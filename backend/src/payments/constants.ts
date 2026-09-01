/** Payment module constants */

// ─── JazzCash ───
export const JAZZCASH_API_VERSION = '1.1';
export const JAZZCASH_LANGUAGE = 'EN';
export const JAZZCASH_CURRENCY = 'PKR';
export const JAZZCASH_SUCCESS_CODE = '000';
export const JAZZCASH_TXN_REF_PREFIX = 'T';
export const JAZZCASH_HASH_ALGORITHM = 'sha256';

// ─── EasyPaisa ───
export const EASYPAISA_SUCCESS_CODES = ['0000', 'success'] as const;
export const EASYPAISA_ORDER_PREFIX = 'EP-';
export const EASYPAISA_AUTO_REDIRECT = '1';
export const EASYPAISA_INITIAL_PAYMENT_METHOD = 'InitialRequest';
export const EASYPAISA_HASH_ALGORITHM = 'sha256';

// ─── Stripe ───
export const STRIPE_CHECKOUT_COMPLETED = 'checkout.session.completed';
export const STRIPE_PAYMENT_STATUS_PAID = 'paid';
export const STRIPE_PRODUCT_NAME = 'Ad Package Purchase';

// ─── Shared ───
export const AMOUNT_MULTIPLIER = 100;
export const TXN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Routes ───
export const PAYMENT_ROUTES = {
  BASE: 'api/payments',
  STRIPE_WEBHOOK: 'stripe/webhook',
  PACKAGE_CALLBACK: '/api/packages/payment-callback',
} as const;

export const PACKAGE_ROUTES = {
  BASE: 'api/packages',
  AVAILABLE: 'available',
  MY_PURCHASES: 'my-purchases',
  PURCHASE: 'purchase',
  PAYMENT_CALLBACK: 'payment-callback',
} as const;

// ─── Config keys ───
export const CONFIG_KEYS = {
  JAZZCASH_MERCHANT_ID: 'payments.jazzcash.merchantId',
  JAZZCASH_PASSWORD: 'payments.jazzcash.password',
  JAZZCASH_INTEGRITY_SALT: 'payments.jazzcash.integritySalt',
  JAZZCASH_BASE_URL: 'payments.jazzcash.baseUrl',
  JAZZCASH_RETURN_URL: 'payments.jazzcash.returnUrl',
  EASYPAISA_STORE_ID: 'payments.easypaisa.storeId',
  EASYPAISA_HASH_KEY: 'payments.easypaisa.hashKey',
  EASYPAISA_BASE_URL: 'payments.easypaisa.baseUrl',
  EASYPAISA_RETURN_URL: 'payments.easypaisa.returnUrl',
  ALLOW_UNSIGNED_CALLBACKS: 'payments.allowUnsignedCallbacks',
  STRIPE_SECRET_KEY: 'payments.stripe.secretKey',
  STRIPE_WEBHOOK_SECRET: 'payments.stripe.webhookSecret',
  STRIPE_SUCCESS_URL: 'payments.stripe.successUrl',
  STRIPE_CANCEL_URL: 'payments.stripe.cancelUrl',
} as const;

/**
 * Random characters appended to a gateway transaction reference.
 *
 * A reference built only from a timestamp is guessable, which matters because the
 * payment callback route is reachable without an API key. Five base36 characters
 * add ~26 bits, and JazzCash allows 20 characters for pp_TxnRefNo against the 15
 * the prefix and timestamp already use.
 */
export const TXN_REF_ENTROPY_CHARS = 5;

/**
 * Parameters that take part in JazzCash's secure hash.
 *
 * Its own `pp_*` and `ppmpf_*` fields only. Anything the application adds to the
 * payload before verification must not be hashed, or the digest covers data
 * JazzCash never signed and can never match.
 */
export const JAZZCASH_HASHED_FIELD_PATTERN = /^(pp_|ppmpf_)/;

/** Fields the application injects, which EasyPaisa never signed. */
export const EASYPAISA_UNSIGNED_FIELDS: readonly string[] = [
  'transactionId',
  'paymentMethod',
];
