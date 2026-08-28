/**
 * Where an ad can be shown.
 *
 * Each value corresponds to a slot the frontend renders. Adding a value here is
 * what makes a new surface sellable, so the list is deliberately explicit rather
 * than a free-form string.
 */
export enum AdPlacement {
  /** Wide banner across the top of the home page. */
  HOME_TOP = 'home_top',
  /** Banner between home page sections. */
  HOME_MID = 'home_mid',
  /** Wide banner above the search results. */
  SEARCH_TOP = 'search_top',
  /** Card injected into a listing grid, styled like a listing. */
  IN_FEED = 'in_feed',
  /** Banner on a listing detail page. */
  LISTING_DETAIL = 'listing_detail',
  /** Panel below the search filter sidebar. */
  SIDEBAR = 'sidebar',
  /** Full-bleed slide between shorts. */
  SHORTS_FEED = 'shorts_feed',
}

/** Lifecycle of a campaign. */
export enum AdCampaignStatus {
  /** Being prepared; never served. */
  DRAFT = 'draft',
  /** Approved and waiting for its start date. */
  SCHEDULED = 'scheduled',
  /** Currently servable. */
  ACTIVE = 'active',
  /** Temporarily stopped by an admin. */
  PAUSED = 'paused',
  /** Past its end date or a cap was reached. */
  COMPLETED = 'completed',
  /** Hidden from the working list, kept for reporting. */
  ARCHIVED = 'archived',
}

/** How the advertiser is billed. Recorded for reporting; billing is out of scope. */
export enum AdPricingModel {
  /** Cost per thousand impressions. */
  CPM = 'cpm',
  /** Cost per click. */
  CPC = 'cpc',
  /** Fixed fee for the flight. */
  FLAT = 'flat',
}

/** Device classes a campaign can be limited to. */
export enum AdDevice {
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
}

/** Recorded interaction types. */
export enum AdEventType {
  IMPRESSION = 'impression',
  CLICK = 'click',
}

/** Advertiser account state. */
export enum AdvertiserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** Placements rendered as a listing-shaped card rather than a banner. */
export const NATIVE_PLACEMENTS: ReadonlySet<AdPlacement> = new Set([
  AdPlacement.IN_FEED,
]);
