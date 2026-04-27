/** Failure reasons tracked in PACKAGE_APPLY_FAILED events. */
export const enum ApplyFailureReason {
  CATEGORY_MISMATCH = 'category_mismatch',
  PAYMENT_NOT_COMPLETED = 'payment_not_completed',
  FULLY_USED = 'fully_used',
  EXPIRED = 'expired',
  UNKNOWN = 'unknown',
}
