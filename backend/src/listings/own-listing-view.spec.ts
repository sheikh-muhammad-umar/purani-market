import {
  OwnListingView,
  ownViewConditions,
  parseOwnListingView,
} from './own-listing-view';
import { ListingStatus } from './schemas/product-listing.schema';
import { LISTING_EXPIRING_SOON_DAYS } from '../common/constants/app.constants';
import { daysToMs } from '../common/utils/time';

describe('own listing views', () => {
  describe('ownViewConditions', () => {
    it.each([
      [OwnListingView.ACTIVE, ListingStatus.ACTIVE],
      [OwnListingView.PENDING, ListingStatus.PENDING_REVIEW],
      [OwnListingView.REJECTED, ListingStatus.REJECTED],
      [OwnListingView.INACTIVE, ListingStatus.INACTIVE],
      [OwnListingView.EXPIRED, ListingStatus.EXPIRED],
    ])('maps %s to its status', (view, status) => {
      expect(ownViewConditions(view)).toEqual({ status });
    });

    it('leaves "all" unfiltered so sold and reserved stay reachable', () => {
      // Neither has a tab of its own, so an empty condition set is the only thing
      // keeping them visible anywhere.
      expect(ownViewConditions(OwnListingView.ALL)).toEqual({});
    });

    it('bounds "expiring soon" at both ends', () => {
      const now = new Date('2026-03-10T12:00:00Z');

      const conditions = ownViewConditions(OwnListingView.EXPIRING_SOON) as {
        status: string;
      };
      expect(conditions.status).toBe(ListingStatus.ACTIVE);

      const bounded = ownViewConditions(OwnListingView.EXPIRING_SOON, now) as {
        expiresAt: { $gt: Date; $lte: Date };
      };
      // Lower bound excludes anything already gone, which belongs under Expired;
      // without it a listing would sit in two tabs at once.
      expect(bounded.expiresAt.$gt).toEqual(now);
      expect(bounded.expiresAt.$lte).toEqual(
        new Date(now.getTime() + daysToMs(LISTING_EXPIRING_SOON_DAYS)),
      );
    });

    it('uses the clock it is handed, so one request cannot straddle the boundary', () => {
      const now = new Date('2026-03-10T12:00:00Z');
      const first = ownViewConditions(OwnListingView.EXPIRING_SOON, now);
      const second = ownViewConditions(OwnListingView.EXPIRING_SOON, now);
      expect(first).toEqual(second);
    });
  });

  describe('parseOwnListingView', () => {
    it('accepts every known view', () => {
      for (const view of Object.values(OwnListingView)) {
        expect(parseOwnListingView(view)).toBe(view);
      }
    });

    it.each([undefined, '', 'sold', 'ACTIVE', 'drop table'])(
      'falls back to all for %p',
      (value) => {
        // A stale bookmark or a hand-edited URL should show the seller their ads,
        // not an empty page or an error.
        expect(parseOwnListingView(value as string)).toBe(OwnListingView.ALL);
      },
    );
  });
});
