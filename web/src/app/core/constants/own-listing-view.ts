/**
 * The slices a seller can filter their own ads by.
 *
 * Values match the backend's `OwnListingView` exactly, since they travel as the
 * `view` query parameter. Two are not statuses: "expiring soon" is an active ad
 * near its expiry date, and "all" means no filter.
 */
export type OwnListingView =
  | 'all'
  | 'active'
  | 'pending'
  | 'rejected'
  | 'inactive'
  | 'expiring_soon'
  | 'expired';

/** One filter tab. */
export interface OwnListingViewTab {
  view: OwnListingView;
  label: string;
  icon: string;
}

/**
 * Tabs in the order a seller works through them.
 *
 * All first as the default landing view, then the ones needing action —
 * rejected and expiring soon are the two where doing nothing costs the seller
 * money, so they sit before the passive states.
 */
export const OWN_LISTING_VIEW_TABS: readonly OwnListingViewTab[] = [
  { view: 'all', label: 'All', icon: 'inventory_2' },
  { view: 'active', label: 'Active', icon: 'check_circle' },
  { view: 'pending', label: 'Pending', icon: 'hourglass_top' },
  { view: 'rejected', label: 'Rejected', icon: 'cancel' },
  { view: 'expiring_soon', label: 'Expiring soon', icon: 'schedule' },
  { view: 'expired', label: 'Expired', icon: 'event_busy' },
  { view: 'inactive', label: 'Inactive', icon: 'visibility_off' },
];
