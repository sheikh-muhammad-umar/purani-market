import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import {
  AdminService,
  MetricsSummary,
  TimeSeriesPoint,
  CategoryAnalytics,
  DateRange,
  AppBannerStats,
  EngagementAnalytics,
  PriceTrendsData,
} from '../../../core/services/admin.service';
import {
  GuestVsAuthEntry,
  DeviceBreakdownEntry,
  CategoryPriceTrend,
} from '../../../core/models/analytics.model';
import {
  IdVerificationStats,
  IdVerificationTimeSeriesEntry,
} from '../../../core/models/id-verification.model';

export interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'currency';
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, TooltipDirective],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
})
export class AnalyticsDashboardComponent implements OnInit {
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
  readonly categoryAnalytics = signal<CategoryAnalytics[]>([]);
  readonly bannerStats = signal<AppBannerStats | null>(null);
  readonly engagement = signal<EngagementAnalytics | null>(null);
  readonly priceTrends = signal<PriceTrendsData | null>(null);
  readonly idVerificationStats = signal<IdVerificationStats | null>(null);

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
    return [
      { label: 'Total Users', value: m.totalUsers, icon: 'group', format: 'number' },
      { label: 'Active Users (30d)', value: m.activeUsers, icon: 'person_check', format: 'number' },
      { label: 'Total Listings', value: m.totalListings, icon: 'list_alt', format: 'number' },
      { label: 'Conversations', value: m.totalConversations, icon: 'chat', format: 'number' },
      { label: 'Purchases', value: m.totalPurchases, icon: 'shopping_cart', format: 'number' },
      {
        label: 'Revenue',
        value: m.totalRevenue,
        icon: 'account_balance_wallet',
        format: 'currency',
      },
    ];
  });

  readonly maxCategoryCount = computed(() => {
    const cats = this.categoryAnalytics();
    if (cats.length === 0) return 1;
    return Math.max(...cats.map((c) => c.listingCount), 1);
  });

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

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.startDate = this.formatDateInput(thirtyDaysAgo);
    this.endDate = this.formatDateInput(now);
    this.loadAnalytics();
    this.loadBannerStats();
    this.loadEngagement();
    this.loadPriceTrends();
    this.loadIdVerificationStats();
  }

  loadAnalytics(): void {
    this.loading.set(true);
    this.error.set(null);
    const dateRange: DateRange | undefined =
      this.startDate && this.endDate
        ? { startDate: this.startDate, endDate: this.endDate }
        : undefined;

    this.adminService.getAnalytics(dateRange).subscribe({
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
  }

  private loadBannerStats(): void {
    const dateRange: DateRange | undefined =
      this.startDate && this.endDate
        ? { startDate: this.startDate, endDate: this.endDate }
        : undefined;
    this.adminService.getAppBannerStats(dateRange).subscribe({
      next: (stats) => this.bannerStats.set(stats),
      error: () => {},
    });
  }

  private loadEngagement(): void {
    const dateRange: DateRange | undefined =
      this.startDate && this.endDate
        ? { startDate: this.startDate, endDate: this.endDate }
        : undefined;
    this.adminService.getEngagementAnalytics(dateRange).subscribe({
      next: (data) => this.engagement.set(data),
      error: () => {},
    });
  }

  private loadPriceTrends(): void {
    const dateRange: DateRange | undefined =
      this.startDate && this.endDate
        ? { startDate: this.startDate, endDate: this.endDate }
        : undefined;
    this.adminService.getPriceTrends(dateRange).subscribe({
      next: (data) => this.priceTrends.set(data),
      error: () => {},
    });
  }

  getMaxPriceChanges(categories: CategoryPriceTrend[]): number {
    if (!categories.length) return 1;
    return Math.max(...categories.map((c) => c.totalChanges), 1);
  }

  exportReport(): void {
    if (!this.startDate || !this.endDate) return;
    this.exporting.set(true);

    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(','));
    const blank = () => lines.push('');
    const header = (title: string) => {
      blank();
      add(title);
      add('');
    };

    // ── Report Header ──────────────────────────────────
    add('ANALYTICS REPORT');
    add('Date Range', `${this.startDate} to ${this.endDate}`);
    add('Generated', new Date().toLocaleString());

    // ── Key Metrics ────────────────────────────────────
    const m = this.metrics();
    if (m) {
      header('KEY METRICS');
      add('Metric', 'Value');
      add('Total Users', m.totalUsers);
      add('Active Users (30d)', m.activeUsers);
      add('Total Listings', m.totalListings);
      add('Conversations', m.totalConversations);
      add('Purchases', m.totalPurchases);
      add('Revenue', m.totalRevenue);
    }

    // ── Trends ─────────────────────────────────────────
    const ts = this.timeSeries();
    if (ts) {
      const series = [
        { name: 'Registrations', data: ts.registrations },
        { name: 'Listings', data: ts.listings },
        { name: 'Conversations', data: ts.conversations },
        { name: 'Purchases', data: ts.purchases },
      ];
      for (const s of series) {
        if (s.data.length > 0) {
          header(`TRENDS - ${s.name.toUpperCase()}`);
          add('Date', 'Count');
          for (const p of s.data) add(p.date, p.value);
          add(
            'Total',
            s.data.reduce((sum, p) => sum + p.value, 0),
          );
        }
      }
    }

    // ── Guest vs Authenticated ─────────────────────────
    const eng = this.engagement();
    if (eng?.guestVsAuth) {
      header('GUEST VS AUTHENTICATED');
      add('Action', 'Guest', 'Authenticated');
      for (const [action, val] of Object.entries(eng.guestVsAuth)) {
        add(this.formatAction(action), val.guest, val.authenticated);
      }
    }

    // ── Top Searches ───────────────────────────────────
    if (eng?.topSearches?.length) {
      header('TOP SEARCHES');
      add('Rank', 'Search Term', 'Count');
      eng.topSearches.forEach((s, i) => add(i + 1, s.term, s.count));
    }

    // ── Top Viewed Listings ────────────────────────────
    if (eng?.topViewedListings?.length) {
      header('TOP VIEWED LISTINGS');
      add('Title', 'Views', 'Favorites', 'Price');
      for (const l of eng.topViewedListings) {
        add(l.title, l.viewCount, l.favoriteCount, l.price?.amount ?? 0);
      }
    }

    // ── Peak Hours ─────────────────────────────────────
    if (eng?.hourlyActivity?.length) {
      header('PEAK HOURS');
      add('Hour', 'Actions');
      for (const h of eng.hourlyActivity) add(this.formatHour(h.hour), h.count);
    }

    // ── Listings by Category ───────────────────────────
    const cats = this.categoryAnalytics();
    if (cats.length > 0) {
      header('LISTINGS BY CATEGORY');
      add('Category', 'Listings', 'Share %');
      for (const c of cats)
        add(c.categoryName, c.listingCount, this.getCategoryPercent(c.listingCount));
    }

    // ── Price Trends ───────────────────────────────────
    const pt = this.priceTrends();
    if (pt) {
      if (pt.categories.length > 0) {
        header('PRICE TRENDS BY CATEGORY');
        add('Summary', '');
        add('Total Price Changes', pt.totalPriceChanges);
        add('Avg Price Increase', pt.avgPriceIncrease);
        add('Avg Price Decrease', pt.avgPriceDecrease);
        blank();
        add('Category', 'Edits', 'Avg Before', 'Avg After', 'Diff %', 'Direction');
        for (const c of pt.categories) {
          add(
            c.categoryName,
            c.totalChanges,
            c.avgPreviousPrice,
            c.avgNewPrice,
            c.avgDiffPct,
            c.direction,
          );
        }
      }
      if (pt.recentChanges.length > 0) {
        header('RECENT PRICE CHANGES');
        add('Listing', 'Category', 'Before', 'After', 'Diff', 'Date');
        for (const r of pt.recentChanges) {
          add(r.title, r.categoryName, r.previousPrice, r.newPrice, r.diff, r.date.split('T')[0]);
        }
      }
    }

    // ── Device Distribution ────────────────────────────
    if (eng?.deviceBreakdown?.length) {
      header('DEVICE DISTRIBUTION');
      add('Device', 'Events', 'Percentage');
      const devPcts = this.getDevicePercentages(eng.deviceBreakdown);
      for (const d of devPcts) add(d.device, d.count, `${d.pct}%`);
    }

    // ── Login Failures ─────────────────────────────────
    if (eng?.loginFailures?.length) {
      header('LOGIN FAILURES');
      add('Date', 'Failures');
      for (const f of eng.loginFailures) add(f.date, f.count);
    }

    // ── Activity Breakdown ─────────────────────────────
    if (eng?.actionBreakdown?.length) {
      header('ACTIVITY BREAKDOWN');
      add('Action', 'Count');
      for (const a of eng.actionBreakdown) add(this.formatAction(a.action), a.count);
    }

    // ── App Banner ─────────────────────────────────────
    const bs = this.bannerStats();
    if (bs) {
      header('APP DOWNLOAD BANNER');
      add('Impressions', bs.shown);
      add('Clicks', bs.clicks);
      add('Click Rate', `${bs.clickRate}%`);
      add('Dismissed', bs.dismissals);
      add('Dismiss Rate', `${bs.dismissRate}%`);
      if (bs.byPlatform.length > 0) {
        blank();
        add('Platform', 'Shown', 'Clicks', 'Dismissed');
        for (const p of bs.byPlatform) add(p.platform, p.shown, p.clicks, p.dismissals);
      }
    }

    // ── Generate file ──────────────────────────────────
    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${this.startDate}-to-${this.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.exporting.set(false);
  }

  formatValue(value: number, format: 'number' | 'currency'): string {
    if (format === 'currency') {
      return `${CURRENCY_SYMBOL} ${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }

  getBarWidth(count: number): number {
    return (count / this.maxCategoryCount()) * 100;
  }

  getMaxTimeSeriesValue(points: TimeSeriesPoint[]): number {
    if (!points || points.length === 0) return 1;
    return Math.max(...points.map((p) => p.value), 1);
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

  getIdVerificationBarHeight(value: number, series: IdVerificationTimeSeriesEntry[]): number {
    const max = Math.max(...series.map((s) => s.submitted), 1);
    return Math.max(4, (value / max) * 100);
  }
}
