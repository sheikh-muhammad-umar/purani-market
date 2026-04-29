/** Sentinel value sent by the frontend when user selects "Other" brand/model/variant. */
export const OTHER_OPTION_ID = 'other';

/**
 * Fields excluded from public listing list responses.
 * The minus prefix tells Mongoose to exclude these fields.
 */
export const LISTING_PUBLIC_SELECT =
  '-purchaseId -rejectionReasonIds -rejectionNote -rejectedAt -deactivatedAt -deletionReason -__v';
