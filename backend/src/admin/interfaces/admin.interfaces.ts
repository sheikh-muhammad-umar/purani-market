import { ProductListingDocument } from '../../listings/schemas/product-listing.schema.js';
import { PackagePurchaseDocument } from '../../packages/schemas/package-purchase.schema.js';

export interface PaginatedUsers {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedListings {
  data: ProductListingDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserActivitySummary {
  listingsCount: number;
  activeListingsCount: number;
  conversationsCount: number;
  violationsCount: number;
}

export interface TimeSeriesEntry {
  date: string;
  count: number;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  listingCount: number;
}

/** A metric measured over the selected window and the one immediately before it. */
export interface PeriodDelta {
  current: number;
  previous: number;
  /** Signed percentage change, to 1dp. Zero when the previous period was empty. */
  changePct: number;
}

export interface AnalyticsData {
  keyMetrics: {
    totalUsers: number;
    activeUsers: number;
    totalListings: number;
    totalConversations: number;
    totalPackagePurchases: number;
    totalRevenue: number;
  };
  /**
   * Growth within the selected window against the preceding one of equal length.
   *
   * `keyMetrics` are lifetime totals, which cannot rise or fall and so say nothing
   * about direction. These are the counts of things created inside the window,
   * which is what a comparison can actually be drawn against.
   */
  comparison: {
    period: { from: string; to: string };
    previous: { from: string; to: string };
    newUsers: PeriodDelta;
    newListings: PeriodDelta;
    newConversations: PeriodDelta;
    purchases: PeriodDelta;
    revenue: PeriodDelta;
  };
  timeSeries: {
    registrations: TimeSeriesEntry[];
    listings: TimeSeriesEntry[];
    conversations: TimeSeriesEntry[];
    purchases: TimeSeriesEntry[];
  };
  categoryAnalytics: CategoryAnalytics[];
}

/**
 * Every report in one payload, for the complete export.
 *
 * The per-report blocks are loose records rather than named interfaces because
 * each report method already returns `Record<string, any>`; typing them here
 * would only restate that without adding a guarantee.
 */
export interface AnalyticsExport {
  generatedAt: string;
  dateRange: { from: string; to: string };
  /** Dates in this export are bucketed in this timezone, not UTC. */
  timezone: string;
  keyMetrics: AnalyticsData['keyMetrics'];
  timeSeries: AnalyticsData['timeSeries'];
  categoryAnalytics: CategoryAnalytics[];
  comparison?: AnalyticsData['comparison'];
  engagement: Record<string, any>;
  appBanner: Record<string, any>;
  voiceSearch: Record<string, any>;
  priceTrends: Record<string, any>;
  retention: Record<string, any>;
  revenue: Record<string, any>;
  otp: Record<string, any>;
  socialLogins: Record<string, any>;
  traffic: Record<string, any>;
  listingFunnel: Record<string, any>;
  behaviour: Record<string, any>;
  idVerification: Record<string, any>;
}

export interface PaginatedPurchases {
  data: PackagePurchaseDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SellerAdInfo {
  sellerId: string;
  activeListingCount: number;
  listingLimit: number;
  remainingFreeSlots: number;
  activePackageSlots: number;
}
