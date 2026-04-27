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

export interface AnalyticsData {
  keyMetrics: {
    totalUsers: number;
    activeUsers: number;
    totalListings: number;
    totalConversations: number;
    totalPackagePurchases: number;
    totalRevenue: number;
  };
  timeSeries: {
    registrations: TimeSeriesEntry[];
    listings: TimeSeriesEntry[];
    conversations: TimeSeriesEntry[];
    purchases: TimeSeriesEntry[];
  };
  categoryAnalytics: CategoryAnalytics[];
}

export interface AnalyticsExport {
  generatedAt: string;
  dateRange: { from: string; to: string };
  keyMetrics: AnalyticsData['keyMetrics'];
  timeSeries: AnalyticsData['timeSeries'];
  categoryAnalytics: CategoryAnalytics[];
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
  activeAdCount: number;
  adLimit: number;
  remainingFreeSlots: number;
  activePackageSlots: number;
}
