/**
 * Where an ad can be shown. Mirrors the backend `AdPlacement` enum; adding a
 * value here without a matching slot in the UI simply means it never renders.
 */
export type AdPlacement =
  | 'home_top'
  | 'home_mid'
  | 'search_top'
  | 'in_feed'
  | 'listing_detail'
  | 'sidebar'
  | 'shorts_feed';

export type AdCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type AdPricingModel = 'cpm' | 'cpc' | 'flat';

export type AdDevice = 'mobile' | 'desktop';

export type AdEventType = 'impression' | 'click';

export type AdvertiserStatus = 'active' | 'inactive';

/** A brand buying advertising space. */
export interface Advertiser {
  _id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  notes?: string;
  status: AdvertiserStatus;
  createdAt: string;
  updatedAt: string;
}

/** Empty arrays mean "no restriction", matching the backend. */
export interface AdTargeting {
  placements: AdPlacement[];
  categoryIds: string[];
  provinceIds: string[];
  cityIds: string[];
  devices: AdDevice[];
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
}

export interface AdCampaign {
  _id: string;
  advertiserId: string;
  name: string;
  status: AdCampaignStatus;
  startAt: string;
  endAt: string;
  priority: number;
  pricingModel: AdPricingModel;
  budgetAmount: number;
  currency: string;
  /** 0 means no cap. */
  maxImpressions: number;
  maxClicks: number;
  dailyImpressionCap: number;
  targeting: AdTargeting;
  metrics: AdMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface AdCreative {
  _id: string;
  campaignId: string;
  placement: AdPlacement;
  title: string;
  body?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  destinationUrl?: string;
  routeLink?: string;
  ctaLabel?: string;
  weight: number;
  isActive: boolean;
  metrics: AdMetrics;
  createdAt: string;
  updatedAt: string;
}

/** A creative prepared for rendering, as returned by the public serve endpoint. */
export interface ServedAd {
  creativeId: string;
  campaignId: string;
  placement: AdPlacement;
  title: string;
  body?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  destinationUrl?: string;
  routeLink?: string;
  ctaLabel?: string;
  advertiserName?: string;
}

/** Optional narrowing sent with a serve request. */
export interface AdServeContext {
  categoryId?: string;
  provinceId?: string;
  cityId?: string;
  limit?: number;
}

export interface AdPerformanceRow {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  /** Percentage, already rounded by the API. */
  ctr: number;
}

export interface AdPerformanceReport {
  from: string;
  to: string;
  totals: { impressions: number; clicks: number; ctr: number };
  campaigns: AdPerformanceRow[];
  creatives: AdPerformanceRow[];
  daily: { date: string; impressions: number; clicks: number }[];
}

/** Payloads for admin writes. Ids are strings at the boundary. */
export interface AdvertiserPayload {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  notes?: string;
  status?: AdvertiserStatus;
}

export interface AdCampaignPayload {
  advertiserId: string;
  name: string;
  status?: AdCampaignStatus;
  startAt: string;
  endAt: string;
  priority?: number;
  pricingModel?: AdPricingModel;
  budgetAmount?: number;
  currency?: string;
  maxImpressions?: number;
  maxClicks?: number;
  dailyImpressionCap?: number;
  targeting: {
    placements: AdPlacement[];
    categoryIds?: string[];
    provinceIds?: string[];
    cityIds?: string[];
    devices?: AdDevice[];
  };
}

export interface AdCreativePayload {
  campaignId: string;
  placement: AdPlacement;
  title: string;
  body?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  destinationUrl?: string;
  routeLink?: string;
  ctaLabel?: string;
  weight?: number;
  isActive?: boolean;
}

/** Human labels for the placement values, for admin dropdowns. */
export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  home_top: 'Home — top banner',
  home_mid: 'Home — mid banner',
  search_top: 'Search — top banner',
  in_feed: 'In listings feed (native card)',
  listing_detail: 'Listing detail page',
  sidebar: 'Search sidebar',
  shorts_feed: 'Shorts feed',
};

export const AD_CAMPAIGN_STATUS_LABELS: Record<AdCampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};
