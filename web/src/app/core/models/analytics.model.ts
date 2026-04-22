export interface MetricsSummary {
  totalUsers: number;
  activeUsers: number;
  totalListings: number;
  totalConversations: number;
  totalPurchases: number;
  totalRevenue: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TimeSeriesData {
  registrations: TimeSeriesPoint[];
  listings: TimeSeriesPoint[];
  conversations: TimeSeriesPoint[];
  purchases: TimeSeriesPoint[];
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  listingCount: number;
}

export interface AnalyticsData {
  metrics: MetricsSummary;
  timeSeries: TimeSeriesData;
  categoryAnalytics: CategoryAnalytics[];
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface AppBannerStats {
  shown: number;
  clicks: number;
  dismissals: number;
  clickRate: number;
  dismissRate: number;
  byPlatform: {
    platform: string;
    shown: number;
    clicks: number;
    dismissals: number;
  }[];
}
