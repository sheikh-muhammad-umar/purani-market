/**
 * Leaf definitions for what a package grants.
 *
 * Deliberately free of imports: the package schema needs {@link EntitlementKind}
 * while the helpers in `entitlements.ts` need `AdPackageType` from that schema, so
 * keeping the vocabulary here is what stops the two importing each other.
 */

export enum EntitlementKind {
  /** Extra concurrent listings, credited to `user.listingLimit`. */
  AD_SLOTS = 'ad_slots',
  /** Listings that may be promoted to featured. */
  FEATURED_ADS = 'featured_ads',
  /** Short videos the seller may upload. */
  SHORTS = 'shorts',
}

/** What a package promises. */
export interface EntitlementGrant {
  kind: EntitlementKind;
  quantity: number;
}

/** What a purchase still holds, snapshotted at purchase time. */
export interface EntitlementBalance extends EntitlementGrant {
  remaining: number;
}
