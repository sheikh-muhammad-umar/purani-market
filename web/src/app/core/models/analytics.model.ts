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

export interface GuestVsAuthEntry {
  guest: number;
  authenticated: number;
}

export interface TopSearch {
  term: string;
  count: number;
}

export interface TopViewedListing {
  _id: string;
  title: string;
  viewCount: number;
  favoriteCount: number;
  price?: { amount: number; currency: string };
}

export interface LoginFailurePoint {
  date: string;
  count: number;
}

export interface ActionBreakdownEntry {
  action: string;
  count: number;
}

export interface DeviceBreakdownEntry {
  device: string;
  count: number;
}

export interface HourlyActivityEntry {
  hour: number;
  count: number;
}

export interface EngagementAnalytics {
  guestVsAuth: Record<string, GuestVsAuthEntry>;
  topSearches: TopSearch[];
  topViewedListings: TopViewedListing[];
  loginFailures: LoginFailurePoint[];
  actionBreakdown: ActionBreakdownEntry[];
  deviceBreakdown: DeviceBreakdownEntry[];
  hourlyActivity: HourlyActivityEntry[];
}
