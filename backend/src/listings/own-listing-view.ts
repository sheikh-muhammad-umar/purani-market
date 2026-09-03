import { ListingStatus } from './schemas/product-listing.schema.js';
import { LISTING_EXPIRING_SOON_DAYS } from '../common/constants/app.constants.js';
import { daysToMs } from '../common/utils/time.js';

/**
 * The slices a seller can filter their own listings by.
 *
 * Named as views rather than statuses because two of them are not statuses at
 * all: "expiring soon" is an active listing near its expiry date, and "all" is
 * the absence of a filter. Keeping them in one vocabulary means the client sends
 * one parameter instead of a status plus a pair of date bounds it would have to
 * know how to compute.
 */
export enum OwnListingView {
  ALL = 'all',
  ACTIVE = 'active',
  PENDING = 'pending',
  REJECTED = 'rejected',
  INACTIVE = 'inactive',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
}

/**
 * Mongo conditions for one view.
 *
 * Returns the conditions to merge into the seller-scoped filter rather than a
 * whole filter, so the caller keeps ownership of the seller and soft-delete
 * clauses and there is no way to accidentally widen them here.
 *
 * `now` is passed in so a listing sitting exactly on the boundary cannot land in
 * both "expiring soon" and "expired" within one request, which two separate
 * `new Date()` calls would allow.
 */
export function ownViewConditions(
  view: OwnListingView,
  now: Date = new Date(),
): Record<string, unknown> {
  switch (view) {
    case OwnListingView.ACTIVE:
      return { status: ListingStatus.ACTIVE };
    case OwnListingView.PENDING:
      return { status: ListingStatus.PENDING_REVIEW };
    case OwnListingView.REJECTED:
      return { status: ListingStatus.REJECTED };
    case OwnListingView.INACTIVE:
      return { status: ListingStatus.INACTIVE };
    case OwnListingView.EXPIRED:
      return { status: ListingStatus.EXPIRED };
    case OwnListingView.EXPIRING_SOON:
      // Still live, and close enough to expiry that the seller can still act —
      // renew it, or promote it before it goes. An already-expired listing
      // belongs under Expired, so the window is bounded at both ends.
      return {
        status: ListingStatus.ACTIVE,
        expiresAt: {
          $gt: now,
          $lte: new Date(now.getTime() + daysToMs(LISTING_EXPIRING_SOON_DAYS)),
        },
      };
    case OwnListingView.ALL:
    default:
      // Deliberately unfiltered: sold and reserved listings have no tab of their
      // own, so this is the only place they remain reachable.
      return {};
  }
}

/**
 * Reads a client-supplied view name, falling back to "all".
 *
 * Unknown values are not an error: the parameter comes from a URL a seller may
 * have edited or a bookmark from an older build, and showing them everything is a
 * better answer than an empty list or a 400.
 */
export function parseOwnListingView(value?: string): OwnListingView {
  const views = Object.values(OwnListingView) as string[];
  return value && views.includes(value)
    ? (value as OwnListingView)
    : OwnListingView.ALL;
}
