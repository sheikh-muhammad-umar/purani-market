export interface ListingLimitCheck {
  canPost: boolean;
  activeListingCount: number;
  listingLimit: number;
  message?: string;
}
