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
/**
 * Fields a caller may sort a listing search by.
 *
 * An allow-list because the field name used to be spread straight into `.sort()`,
 * which let a caller force an unindexed sort over the whole collection and — more
 * subtly — order results by a field the projection hides, revealing its relative
 * values without ever returning it.
 */
export const LISTING_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'price.amount',
  'viewCount',
  'favoriteCount',
] as const;

export type ListingSortField = (typeof LISTING_SORT_FIELDS)[number];

export const LISTING_PUBLIC_SELECT =
  '-purchaseId -rejectionReasonIds -rejectionNote -rejectedAt -deactivatedAt -deletionReason -contactInfo -__v';
