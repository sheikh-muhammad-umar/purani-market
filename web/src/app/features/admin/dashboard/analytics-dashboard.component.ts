import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { TabActivityService } from '../../../core/services/tab-activity.service';

/** Shortest gap between moderation-count refreshes while tabbing back and forth. */
const ACTION_ITEMS_MIN_REFRESH_MS = 60_000;
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import {
  AdminService,
  MetricsSummary,
  TimeSeriesPoint,
  CategoryAnalytics,
  DateRange,
  AppBannerStats,
  EngagementAnalytics,
  PriceTrendsData,
  VoiceSearchAnalytics,
} from '../../../core/services/admin.service';
import {
  GuestVsAuthEntry,
  DeviceBreakdownEntry,
  CategoryPriceTrend,
  AnalyticsComparison,
  PeriodDelta,
} from '../../../core/models/analytics.model';
import {
  IdVerificationStats,
  IdVerificationTimeSeriesEntry,
} from '../../../core/models/id-verification.model';
import { daysToMs } from '../../../core/utils/time';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import {
  HeatmapComponent,
  type HeatmapCell,
} from '../../../shared/components/chart/heatmap.component';
import type { ChartColor, ChartSeries } from '../../../shared/components/chart/chart.types';

/** Labels plus the series drawn against them. */
interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

/** Heatmap rows. Order matches the backend's 0-based `$dayOfWeek`, which starts Sunday. */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Heatmap columns: every hour, zero-padded so the row stays evenly spaced. */
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

export interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'currency';
  /**
   * Growth against the preceding period of equal length.
   *
   * Optional because a lifetime total on its own has no direction, and because an
   * older API response may not carry the comparison block.
   */
  delta?: PeriodDelta;
  /** Daily values across the window, drawn as a sparkline on the card. */
  spark?: number[];
}

/** Default lookback period in milliseconds (30 days) */
const DEFAULT_LOOKBACK_MS = daysToMs(30);

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePickerComponent,
    TooltipDirective,
    ChartComponent,
    HeatmapComponent,
  ],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly metrics = signal<MetricsSummary | null>(null);
  readonly timeSeries = signal<{
    registrations: TimeSeriesPoint[];
    listings: TimeSeriesPoint[];
    conversations: TimeSeriesPoint[];
    purchases: TimeSeriesPoint[];
  } | null>(null);
  readonly comparison = signal<AnalyticsComparison | null>(null);
  readonly categoryAnalytics = signal<CategoryAnalytics[]>([]);
  readonly bannerStats = signal<AppBannerStats | null>(null);
  readonly engagement = signal<EngagementAnalytics | null>(null);
  readonly priceTrends = signal<PriceTrendsData | null>(null);
  readonly voiceSearchStats = signal<VoiceSearchAnalytics | null>(null);
  readonly idVerificationStats = signal<IdVerificationStats | null>(null);

  // Action-required quick stats
  readonly pendingListings = signal(0);
  readonly pendingShorts = signal(0);
  readonly pendingVerifications = signal(0);

  startDate = '';
  endDate = '';

  // ── Section filters/search ────────────────────────────
  categorySearch = '';
  categorySortBy: 'name' | 'count' | 'pct' = 'count';
  categorySortDir: 'asc' | 'desc' = 'desc';

  priceTrendSearch = '';
  priceTrendSortBy: 'name' | 'changes' | 'diff' = 'changes';
  priceTrendSortDir: 'asc' | 'desc' = 'desc';

  recentPriceSearch = '';

  activitySearch = '';
  activitySortBy: 'name' | 'count' = 'count';
  activitySortDir: 'asc' | 'desc' = 'desc';

  readonly metricCards = computed<MetricCard[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    const c = this.comparison();
    const ts = this.timeSeries();
    const values = (points: TimeSeriesPoint[] | undefined) => points?.map((p) => p.value);

    // Deltas and sparklines are attached only where they mean something. "Total
    // Users" is a lifetime count, so its movement is the *new* users in the
    // window — which is exactly what the comparison block measures. Active users
    // has no equivalent series, so it stays a bare number rather than being given
    // a misleading one.
    return [
      {
        label: 'Total Users',
        value: m.totalUsers,
        icon: 'group',
        format: 'number',
        delta: this.movement(c?.newUsers),
        spark: values(ts?.registrations),
      },
      { label: 'Active Users (30d)', value: m.activeUsers, icon: 'person_check', format: 'number' },
      {
        label: 'Total Listings',
        value: m.totalListings,
        icon: 'list_alt',
        format: 'number',
        delta: this.movement(c?.newListings),
        spark: values(ts?.listings),
      },
      {
        label: 'Conversations',
        value: m.totalConversations,
        icon: 'chat',
        format: 'number',
        delta: this.movement(c?.newConversations),
        spark: values(ts?.conversations),
      },
      {
        label: 'Purchases',
        value: m.totalPurchases,
        icon: 'shopping_cart',
        format: 'number',
        delta: this.movement(c?.purchases),
        spark: values(ts?.purchases),
      },
      {
        label: 'Revenue',
        value: m.totalRevenue,
        icon: 'account_balance_wallet',
        format: 'currency',
        delta: this.movement(c?.revenue),
      },
    ];
  });

  /**
   * Placeholder labels for a sparkline.
   *
   * The chart needs one label per point to plot a category axis, but a sparkline
   * hides that axis — so the labels are never drawn. They still reach the hidden
   * accessibility table, where a position is more use than a blank.
   */
  protected sparkLabels(values: number[]): string[] {
    return values.map((_, i) => `${i + 1}`);
  }

  /**
   * Drops a comparison that has nothing in either period.
   *
   * "No change vs previous period" against zero and zero is noise dressed as
   * information; an absent delta says the same thing more honestly.
   */
  private movement(delta: PeriodDelta | undefined): PeriodDelta | undefined {
    if (!delta) return undefined;
    return delta.current === 0 && delta.previous === 0 ? undefined : delta;
  }

  /** Direction of a delta, used to pick the arrow and the colour. */
  protected deltaDirection(delta: PeriodDelta): 'up' | 'down' | 'flat' {
    if (delta.current > delta.previous) return 'up';
    if (delta.current < delta.previous) return 'down';
    return 'flat';
  }

  /**
   * How a delta reads in words.
   *
   * A percentage is meaningless when the previous period was empty, so that case
   * states the raw movement instead of showing a 0% that looks like no change.
   */
  protected deltaLabel(delta: PeriodDelta): string {
    if (delta.previous === 0) {
      return delta.current > 0 ? `${delta.current} new` : 'no change';
    }
    const sign = delta.changePct > 0 ? '+' : '';
    return `${sign}${delta.changePct}%`;
  }

  // ── Chart data ───────────────────────────────────────────────────
  //
  // Built as computed signals rather than called from the template, because a
  // template cannot pass the lambda each series needs to pick its value out of a
  // row. Every one of these was a hand-rolled column chart; a time series read as
  // bars turns into an unreadable picket fence once the range picker is set to 90
  // days, which it offers.

  readonly registrationsChart = computed(() =>
    this.dateSeries(this.timeSeries()?.registrations ?? [], 'Registrations', 'primary'),
  );

  readonly conversationsChart = computed(() =>
    this.dateSeries(this.timeSeries()?.conversations ?? [], 'Conversations', 'secondary'),
  );

  readonly purchasesChart = computed(() =>
    this.dateSeries(this.timeSeries()?.purchases ?? [], 'Purchases', 'success'),
  );

  readonly loginFailuresChart = computed(() => {
    const rows = this.engagement()?.loginFailures ?? [];
    return {
      labels: rows.map((row) => this.formatShortDate(row.date)),
      series: [{ label: 'Failed logins', data: rows.map((row) => row.count), color: 'danger' }],
    } satisfies ChartData;
  });

  readonly searchComparisonChart = computed(() => {
    const rows = this.voiceSearchStats()?.searchComparison.dailyComparison ?? [];
    return {
      labels: rows.map((row) => this.formatShortDate(row.date)),
      series: [
        { label: 'Text', data: rows.map((row) => row.text), color: 'primary' },
        { label: 'Voice', data: rows.map((row) => row.voice), color: 'accent' },
      ],
    } satisfies ChartData;
  });

  readonly verificationChart = computed(() => {
    const rows = this.idVerificationStats()?.timeSeries ?? [];
    return {
      labels: rows.map((row) => this.formatShortDate(row.date)),
      series: [
        { label: 'Submitted', data: rows.map((row) => row.submitted), color: 'primary' },
        { label: 'Approved', data: rows.map((row) => row.approved), color: 'success' },
        { label: 'Rejected', data: rows.map((row) => row.rejected), color: 'danger' },
      ],
    } satisfies ChartData;
  });

  /**
   * When activity happens, by weekday and hour.
   *
   * Replaces 24 averaged bars. Those flattened every weekday together, so a
   * Sunday evening rush and a Tuesday morning lull cancelled out and neither was
   * visible.
   */
  readonly activityHeatmap = computed<HeatmapCell[]>(
    () =>
      this.engagement()?.weeklyActivity?.map((entry) => ({
        row: entry.day,
        column: entry.hour,
        value: entry.count,
      })) ?? [],
  );

  readonly heatmapDays = WEEKDAY_LABELS;
  readonly heatmapHours = HOUR_LABELS;

  /**
   * Built here rather than in the template so the sentence reads correctly.
   *
   * The timezone matters: an hour-of-day chart is meaningless without knowing
   * which clock it was bucketed against.
   */
  readonly heatmapNote = computed(() => {
    const timezone = this.engagement()?.timezone;
    const where = timezone ? `, in ${timezone}` : '';
    return `Activity by day and hour${where}. Darker means busier.`;
  });

  /** Fallback for responses that predate the weekday split. */
  readonly hourlyLabels = computed(() =>
    (this.engagement()?.hourlyActivity ?? []).map((entry) => this.formatHour(entry.hour)),
  );

  readonly hourlyChart = computed(() => {
    const rows = this.engagement()?.hourlyActivity ?? [];
    return {
      labels: rows.map((entry) => this.formatHour(entry.hour)),
      series: [{ label: 'Events', data: rows.map((entry) => entry.count), color: 'primary' }],
    } satisfies ChartData;
  });

  /** Shared shape for a dated single-value series. */
  private dateSeries(points: TimeSeriesPoint[], label: string, color: ChartColor): ChartData {
    return {
      labels: points.map((point) => this.formatShortDate(point.date)),
      series: [{ label, data: points.map((point) => point.value), color }],
    };
  }

  // ── Filtered/sorted computed lists ────────────────────
  get filteredCategories(): CategoryAnalytics[] {
    let items = [...this.categoryAnalytics()];
    if (this.categorySearch) {
      const q = this.categorySearch.toLowerCase();
      items = items.filter((c) => c.categoryName.toLowerCase().includes(q));
    }
    const dir = this.categorySortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (this.categorySortBy === 'name') return a.categoryName.localeCompare(b.categoryName) * dir;
      if (this.categorySortBy === 'pct')
        return (
          (this.getCategoryPercent(a.listingCount) - this.getCategoryPercent(b.listingCount)) * dir
        );
      return (a.listingCount - b.listingCount) * dir;
    });
    return items;
  }

  get filteredPriceTrends(): CategoryPriceTrend[] {
    const pt = this.priceTrends();
    if (!pt) return [];
    let items = [...pt.categories];
    if (this.priceTrendSearch) {
      const q = this.priceTrendSearch.toLowerCase();
      items = items.filter((c) => c.categoryName.toLowerCase().includes(q));
    }
    const dir = this.priceTrendSortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (this.priceTrendSortBy === 'name')
        return a.categoryName.localeCompare(b.categoryName) * dir;
      if (this.priceTrendSortBy === 'diff') return (a.avgDiffPct - b.avgDiffPct) * dir;
      return (a.totalChanges - b.totalChanges) * dir;
    });
    return items;
  }

  get filteredRecentPriceChanges(): any[] {
    const pt = this.priceTrends();
    if (!pt) return [];
    if (!this.recentPriceSearch) return pt.recentChanges;
    const q = this.recentPriceSearch.toLowerCase();
    return pt.recentChanges.filter(
      (r) => r.title.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q),
    );
  }

  get filteredActivityBreakdown(): { action: string; count: number }[] {
    const eng = this.engagement();
    if (!eng?.actionBreakdown) return [];
    let items = [...eng.actionBreakdown];
    if (this.activitySearch) {
      const q = this.activitySearch.toLowerCase();
      items = items.filter((a) => this.formatAction(a.action).toLowerCase().includes(q));
    }
    const dir = this.activitySortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (this.activitySortBy === 'name')
        return this.formatAction(a.action).localeCompare(this.formatAction(b.action)) * dir;
      return (a.count - b.count) * dir;
    });
    return items;
  }

  toggleCategorySort(col: 'name' | 'count' | 'pct'): void {
    if (this.categorySortBy === col) {
      this.categorySortDir = this.categorySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.categorySortBy = col;
      this.categorySortDir = col === 'name' ? 'asc' : 'desc';
    }
  }

  togglePriceTrendSort(col: 'name' | 'changes' | 'diff'): void {
    if (this.priceTrendSortBy === col) {
      this.priceTrendSortDir = this.priceTrendSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.priceTrendSortBy = col;
      this.priceTrendSortDir = col === 'name' ? 'asc' : 'desc';
    }
  }

  toggleActivitySort(col: 'name' | 'count'): void {
    if (this.activitySortBy === col) {
      this.activitySortDir = this.activitySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.activitySortBy = col;
      this.activitySortDir = col === 'name' ? 'asc' : 'desc';
    }
  }

  getSortIcon(active: boolean, dir: 'asc' | 'desc'): string {
    if (!active) return 'unfold_more';
    return dir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  constructor(
    private readonly adminService: AdminService,
    private readonly tabActivity: TabActivityService,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
    this.startDate = this.formatDateInput(lookbackStart);
    this.endDate = this.formatDateInput(now);
    this.loadAnalytics();
    this.loadBannerStats();
    this.loadEngagement();
    this.loadPriceTrends();
    this.loadVoiceSearchStats();
    this.loadIdVerificationStats();
    this.loadActionItems();

    // Refresh the moderation queue counts whenever an admin comes back to the
    // tab, rather than on a 60-second timer. A dashboard is left open for hours,
    // so a clock spent most of its requests on a window nobody was watching —
    // and a repeating interval also keeps `ApplicationRef.isStable()` from
    // emitting, which is what stalls hydration everywhere else in the app.
    this.actionItemsSub = this.tabActivity
      .returns(ACTION_ITEMS_MIN_REFRESH_MS)
      .subscribe(() => this.loadActionItems());
  }

  ngOnDestroy(): void {
    this.actionItemsSub?.unsubscribe();
  }

  private actionItemsSub: Subscription | null = null;

  loadAnalytics(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getAnalytics(this.getDateRange()).subscribe({
      next: (data: any) => {
        const km = data?.metrics ?? data?.keyMetrics ?? {};
        this.metrics.set({
          totalUsers: km.totalUsers ?? 0,
          activeUsers: km.activeUsers ?? 0,
          totalListings: km.totalListings ?? 0,
          totalConversations: km.totalConversations ?? 0,
          totalPurchases: km.totalPurchases ?? km.totalPackagePurchases ?? 0,
          totalRevenue: km.totalRevenue ?? 0,
        });
        const ts = data?.timeSeries;
        const mapPoints = (arr: any[]) =>
          (arr ?? []).map((p: any) => ({ date: p.date, value: p.value ?? p.count ?? 0 }));
        this.timeSeries.set({
          registrations: mapPoints(ts?.registrations),
          listings: mapPoints(ts?.listings),
          conversations: mapPoints(ts?.conversations),
          purchases: mapPoints(ts?.purchases),
        });
        this.categoryAnalytics.set(data?.categoryAnalytics ?? []);
        this.comparison.set(data?.comparison ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load analytics data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  applyDateRange(): void {
    this.loadAnalytics();
    this.loadBannerStats();
    this.loadEngagement();
    this.loadPriceTrends();
    this.loadVoiceSearchStats();
  }

  private loadBannerStats(): void {
    this.adminService.getAppBannerStats(this.getDateRange()).subscribe({
      next: (stats) => this.bannerStats.set(stats),
      error: () => {},
    });
  }

  private loadEngagement(): void {
    this.adminService.getEngagementAnalytics(this.getDateRange()).subscribe({
      next: (data) => this.engagement.set(data),
      error: () => {},
    });
  }

  private loadPriceTrends(): void {
    this.adminService.getPriceTrends(this.getDateRange()).subscribe({
      next: (data) => this.priceTrends.set(data),
      error: () => {},
    });
  }

  private loadVoiceSearchStats(): void {
    this.adminService.getVoiceSearchAnalytics(this.getDateRange()).subscribe({
      next: (data) => this.voiceSearchStats.set(data),
      error: () => {},
    });
  }

  private getDateRange(): DateRange | undefined {
    return this.startDate && this.endDate
      ? { startDate: this.startDate, endDate: this.endDate }
      : undefined;
  }

  getMaxPriceChanges(categories: CategoryPriceTrend[]): number {
    if (!categories.length) return 1;
    return Math.max(...categories.map((c) => c.totalChanges), 1);
  }

  /**
   * Downloads the complete export: every report, not just what this screen
   * shows. The CSV is built server-side so the file is identical however it is
   * fetched, and so this component does not have to restate the shape of eleven
   * reports it does not load.
   */
  exportReport(): void {
    if (!this.startDate || !this.endDate) return;
    this.exporting.set(true);

    this.adminService.exportReport({ startDate: this.startDate, endDate: this.endDate }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${this.startDate}-to-${this.endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }

  formatValue(value: number, format: 'number' | 'currency'): string {
    if (format === 'currency') {
      return `${CURRENCY_SYMBOL} ${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }

  getBarHeight(value: number, max: number): number {
    return (value / max) * 100;
  }

  formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  getSeriesTotal(points: TimeSeriesPoint[]): number {
    if (!points || points.length === 0) return 0;
    return points.reduce((sum, p) => sum + p.value, 0);
  }

  getCategoryPercent(count: number): number {
    const total = this.categoryAnalytics().reduce((s, c) => s + c.listingCount, 0);
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  getGuestVsAuthTotal(data: Record<string, GuestVsAuthEntry>): {
    guest: number;
    auth: number;
  } {
    let guest = 0,
      auth = 0;
    for (const v of Object.values(data)) {
      guest += v.guest;
      auth += v.authenticated;
    }
    return { guest, auth };
  }

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  getMaxValue(items: any[], key: string): number {
    if (!items || items.length === 0) return 1;
    return Math.max(...items.map((i) => i[key] ?? 0), 1);
  }

  getDevicePercentages(
    breakdown: DeviceBreakdownEntry[],
  ): { device: string; count: number; pct: number }[] {
    const total = breakdown.reduce((s, d) => s + d.count, 0) || 1;
    return breakdown.map((d) => ({
      device: d.device,
      count: d.count,
      pct: Math.round((d.count / total) * 100),
    }));
  }

  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly today = new Date().toISOString().split('T')[0];

  getMetricTooltip(card: MetricCard): string {
    switch (card.icon) {
      case 'group':
        return 'Total registered users on the platform';
      case 'person_check':
        return 'Users who logged in within the last 30 days';
      case 'list_alt':
        return 'Total listings created (all statuses)';
      case 'chat':
        return 'Total buyer-seller conversations started';
      case 'shopping_cart':
        return 'Total completed package purchases';
      case 'account_balance_wallet':
        return `Total revenue from package sales (${CURRENCY_SYMBOL})`;
      default:
        return card.label;
    }
  }

  private formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private loadIdVerificationStats(): void {
    this.adminService.getIdVerificationStats().subscribe({
      next: (data) => {
        this.idVerificationStats.set(data);
        this.pendingVerifications.set(data.pending ?? 0);
      },
      error: () => {
        this.idVerificationStats.set({
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          timeSeries: [],
        });
      },
    });
  }

  private loadActionItems(): void {
    // Pending listings
    this.adminService.getPendingListings().subscribe({
      next: (res: any) => {
        const data = res && res.data && res.statusCode ? res.data : res;
        this.pendingListings.set(data.total ?? data.listings?.length ?? 0);
      },
      error: () => {},
    });

    // Pending shorts
    this.adminService.getPendingShortsCount().subscribe({
      next: (count) => this.pendingShorts.set(count),
      error: () => {},
    });
  }

  getIdVerificationBarHeight(value: number, series: IdVerificationTimeSeriesEntry[]): number {
    const max = Math.max(...series.map((s) => s.submitted), 1);
    return Math.max(4, (value / max) * 100);
  }
}
