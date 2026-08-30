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

/** A metric over the selected window and the one immediately before it. */
export interface PeriodDelta {
  current: number;
  previous: number;
  /** Signed percentage change. Zero when the previous period had no data. */
  changePct: number;
}

/**
 * Growth inside the selected window against the preceding one of equal length.
 *
 * `metrics` are lifetime totals and so have no direction; these are the counts of
 * things created within the window, which is what a delta can be drawn from.
 */
export interface AnalyticsComparison {
  period: { from: string; to: string };
  previous: { from: string; to: string };
  newUsers: PeriodDelta;
  newListings: PeriodDelta;
  newConversations: PeriodDelta;
  purchases: PeriodDelta;
  revenue: PeriodDelta;
}

export interface AnalyticsData {
  metrics: MetricsSummary;
  timeSeries: TimeSeriesData;
  categoryAnalytics: CategoryAnalytics[];
  comparison?: AnalyticsComparison;
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
  /** Activity split by weekday and hour. Sparse: only non-empty buckets appear. */
  weeklyActivity?: WeeklyActivityEntry[];
  /** Timezone the hour and weekday buckets were computed in. */
  timezone?: string;
}

export interface WeeklyActivityEntry {
  /** 0 = Sunday through 6 = Saturday. */
  day: number;
  /** 0-23 in the reporting timezone. */
  hour: number;
  count: number;
}

export interface CategoryPriceTrend {
  categoryId: string;
  categoryName: string;
  totalChanges: number;
  avgPreviousPrice: number;
  avgNewPrice: number;
  avgDiff: number;
  avgDiffPct: number;
  direction: 'up' | 'down' | 'stable';
}

export interface RecentPriceChange {
  listingId: string;
  title: string;
  categoryName: string;
  previousPrice: number;
  newPrice: number;
  diff: number;
  date: string;
}

export interface PriceTrendsData {
  categories: CategoryPriceTrend[];
  recentChanges: RecentPriceChange[];
  totalPriceChanges: number;
  avgPriceIncrease: number;
  avgPriceDecrease: number;
}

export interface VoiceSearchAnalytics {
  totalStarted: number;
  totalCompleted: number;
  totalCancelled: number;
  totalErrors: number;
  completionRate: number;
  cancelRate: number;
  errorRate: number;
  topQueries: { term: string; count: number }[];
  byPlatform: {
    platform: string;
    started: number;
    completed: number;
    cancelled: number;
    errors: number;
  }[];
  errorBreakdown: { error: string; count: number }[];
  dailyTrend: { date: string; started: number; completed: number }[];
  searchComparison: {
    totalTextSearches: number;
    totalVoiceSearches: number;
    voiceSearchShare: number;
    dailyComparison: { date: string; text: number; voice: number }[];
  };
}

/**
 * Retention. Active-user counts come from user_activities, so "active" means
 * "did something we track", not "opened the app".
 */
export interface ActiveUsersPoint {
  date: string;
  count: number;
}
export interface WeeklyActiveUsersPoint {
  /** ISO-ish year-week key, e.g. "2026-34". */
  week: string;
  count: number;
}
export interface MonthlyActiveUsersPoint {
  /** Year-month key, e.g. "2026-08". */
  month: string;
  count: number;
}
export interface RetentionAnalytics {
  dailyActiveUsers: ActiveUsersPoint[];
  weeklyActiveUsers: WeeklyActiveUsersPoint[];
  monthlyActiveUsers: MonthlyActiveUsersPoint[];
  /** Users who were active before the window but not inside it. */
  churnedUsers: number;
  /** Percentage, already rounded server-side. */
  retentionRate: number;
}

/** Revenue. Only COMPLETED payments are counted. */
export interface RevenueByPaymentMethod {
  method: string;
  revenue: number;
  count: number;
}
export interface RevenueByPackageType {
  type: string;
  revenue: number;
  count: number;
}
export interface RevenuePoint {
  date: string;
  revenue: number;
  count: number;
}
export interface RevenueAnalytics {
  totalRevenue: number;
  byPaymentMethod: RevenueByPaymentMethod[];
  byPackageType: RevenueByPackageType[];
  revenueTimeSeries: RevenuePoint[];
  avgOrderValue: number;
}

/** OTP delivery and verification. */
export interface OtpSummary {
  totalSent: number;
  totalVerified: number;
  totalFailed: number;
  successRate: number;
}
export interface OtpActionEntry {
  action: string;
  count: number;
}
export interface OtpChannelEntry {
  channel: string;
  count: number;
}
/**
 * One day of OTP events. The server spreads whichever action keys occurred on
 * that day, so a day with no resends simply omits `otp_resent` rather than
 * reporting zero — read these as optional.
 */
export interface OtpPoint {
  date: string;
  otp_sent?: number;
  otp_verified?: number;
  otp_failed?: number;
  otp_resent?: number;
  otp_expired?: number;
  [action: string]: number | string | undefined;
}
export interface UserVerificationStatus {
  emailVerified: number;
  phoneVerified: number;
  unverified: number;
}
export interface OtpAnalytics {
  summary: OtpSummary;
  actionBreakdown: OtpActionEntry[];
  channelBreakdown: OtpChannelEntry[];
  timeSeries: OtpPoint[];
  userVerificationStatus: UserVerificationStatus;
}

/** Social sign-in. */
export interface SocialProviderEntry {
  provider: string;
  count: number;
}
export interface SocialLoginPoint {
  date: string;
  google: number;
  facebook: number;
  apple: number;
}
export interface SocialLoginAnalytics {
  totalSocialLogins: number;
  byProvider: SocialProviderEntry[];
  timeSeries: SocialLoginPoint[];
  newVsReturning: { newUsers: number; returningUsers: number };
}

/**
 * Traffic and acquisition.
 *
 * Mind the two denominators. Session shape (`summary`, `sessionsTimeSeries`,
 * `depthDistribution`) covers every event carrying a sessionId. Everything else
 * covers `session_start` events only, because that is the one event the client
 * attaches referrer and campaign context to. `coverage` reports both so the
 * page can say what share of activity it actually describes.
 */
export interface TrafficSummary {
  sessions: number;
  events: number;
  uniqueVisitors: number;
  /** Median rather than mean: one long-lived tab distorts an average badly. */
  medianEventsPerSession: number;
  medianDurationSeconds: number;
  newVisitors: number;
  returningVisitors: number;
  sessionsPerVisitor: number;
}
export interface SessionsPoint {
  date: string;
  sessions: number;
}
export interface SessionDepthBucket {
  bucket: string;
  sessions: number;
}
export interface ChannelEntry {
  /** direct | organic search | paid | social | referral | email | campaign */
  channel: string;
  sessions: number;
}
export interface ReferrerEntry {
  host: string;
  sessions: number;
}
export interface CampaignEntry {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
}
export interface LandingPageEntry {
  path: string;
  sessions: number;
}
export interface TrafficCoverage {
  totalEvents: number;
  eventsWithSession: number;
  eventsWithVisitor: number;
  sessionStarts: number;
  sessionsWithoutStart: number;
}
export interface TrafficAnalytics {
  summary: TrafficSummary;
  sessionsTimeSeries: SessionsPoint[];
  depthDistribution: SessionDepthBucket[];
  byChannel: ChannelEntry[];
  topReferrers: ReferrerEntry[];
  campaigns: CampaignEntry[];
  landingPages: LandingPageEntry[];
  byDevice: { device: string; sessions: number }[];
  byBrowser: { browser: string; sessions: number }[];
  byOs: { os: string; sessions: number }[];
  byConnection: { connection: string; sessions: number }[];
  signedInSessions: { authenticated: number; guest: number };
  coverage: TrafficCoverage;
  timezone: string;
}

/**
 * Listing funnel: viewed, then contacted, then a conversation started.
 *
 * The unit is a LISTING rather than an event, and the stages are strictly
 * nested server-side, so `pct` can never exceed 100. Anything that skipped a
 * stage lands in `attribution` instead of inflating the funnel.
 */
export interface FunnelStageEntry {
  stage: string;
  listings: number;
  /** Share of the first stage. */
  pct: number;
  /** Listings lost since the previous stage. Null on the first stage. */
  dropOff: number | null;
}
export interface FunnelConversionRates {
  viewToContact: number;
  contactToConversation: number;
  viewToConversation: number;
}
export interface FunnelEventTotals {
  views: number;
  contacts: number;
  favorites: number;
  conversations: number;
  savedListings: number;
}
export interface FunnelTrendPoint {
  date: string;
  views: number;
  contacts: number;
}
export interface FunnelTopListing {
  listingId: string;
  title: string;
  views: number;
  contacts: number;
  favorites: number;
  conversations: number;
  /** Distinct signed-in viewers, so a single refresher does not read as demand. */
  uniqueViewers: number;
}
export interface FunnelCategoryEntry {
  categoryId: string | null;
  /** Qualified with its parent, because leaf category names are not unique. */
  categoryName: string;
  listings: number;
  views: number;
  contacts: number;
  conversations: number;
  viewToContact: number;
}
export interface FunnelAttribution {
  conversationsInRange: number;
  conversationsWithoutListing: number;
  conversationsOnUncontactedListings: number;
}
export interface ListingFunnelAnalytics {
  funnel: FunnelStageEntry[];
  conversionRates: FunnelConversionRates;
  eventTotals: FunnelEventTotals;
  trend: FunnelTrendPoint[];
  topListings: FunnelTopListing[];
  byCategory: FunnelCategoryEntry[];
  attribution: FunnelAttribution;
  timezone: string;
}

/**
 * On-site behaviour: pages, filters, the geography of what gets looked at, and
 * how package purchases end.
 *
 * `viewsByCity` is the city of the LISTING viewed, not of the viewer. It answers
 * "whose stock gets attention" and must not be read as visitor location.
 */
export interface PageEntry {
  path: string;
  views: number;
}
export interface PageSectionEntry {
  /** First path segment, e.g. `/search`, `/listings`, `/admin`. */
  section: string;
  views: number;
}
export interface FilterUsageSummary {
  applies: number;
  withFilters: number;
  /** A filter_apply carrying no keys — someone clearing their filters. */
  cleared: number;
  filterRate: number;
}
export interface FilterCountEntry {
  filterCount: number;
  applies: number;
}
export interface TopFilterEntry {
  key: string;
  uses: number;
}
export interface CityViewsEntry {
  city: string;
  views: number;
  /** Distinct listings in that city that were viewed. */
  listings: number;
}
export interface PackageBrowsing {
  listViewed: number;
  noneAvailable: number;
  /** Share of package browses that found nothing available to buy. */
  emptyShelfRate: number;
  ctaClicked: number;
  purchaseInitiated: number;
  paymentAttempts: number;
  purchaseEvents: number;
}
export interface PurchaseOutcomeEntry {
  status: string;
  purchases: number;
  amount: number;
  pct: number;
}
export interface BehaviourTracking {
  paymentAttemptEventsRecorded: boolean;
  packagePurchaseEventsRecorded: boolean;
  purchaseCtaEventsRecorded: boolean;
}
export interface BehaviourAnalytics {
  topPages: PageEntry[];
  pageSections: PageSectionEntry[];
  pageViewsTracked: number;
  filterUsage: FilterUsageSummary;
  filtersByCount: FilterCountEntry[];
  topFilters: TopFilterEntry[];
  viewsByCity: CityViewsEntry[];
  packageBrowsing: PackageBrowsing;
  purchaseOutcomes: PurchaseOutcomeEntry[];
  purchaseSummary: { total: number; completed: number; completionRate: number };
  tracking: BehaviourTracking;
  timezone: string;
}
