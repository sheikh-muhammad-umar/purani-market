/** Sentinel value sent by the frontend when user selects "Other" brand/model/variant. */
export const OTHER_OPTION_ID = 'other';

/**
 * Fields excluded from public listing list responses.
 * The minus prefix tells Mongoose to exclude these fields.
 *
 * `contactInfo` is excluded because it defaults to the seller's own account phone
 * and email. The single-listing endpoint strips it for anonymous callers, but this
 * projection backs every *list* response — search, nearby, popular and featured —
 * so leaving it in meant one unauthenticated loop over `GET /api/listings?limit=…`
 * harvested the contact details of every seller on the platform, which also
 * defeated the check that forbids phone numbers in listing text. Nothing reads
 * contact details from a list: the detail page fetches the listing on its own, and
 * admin screens use their own unprojected queries.
 */
export const LISTING_PUBLIC_SELECT =
  '-purchaseId -rejectionReasonIds -rejectionNote -rejectedAt -deactivatedAt -deletionReason -contactInfo -__v';
