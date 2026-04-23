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
} from '../../../core/services/admin.service';
import { GuestVsAuthEntry, DeviceBreakdownEntry } from '../../../core/models/analytics.model';

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

  startDate = '';
  endDate = '';

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

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.startDate = this.formatDateInput(thirtyDaysAgo);
    this.endDate = this.formatDateInput(now);
    this.loadAnalytics();
    this.loadBannerStats();
    this.loadEngagement();
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

  exportReport(): void {
    if (!this.startDate || !this.endDate) return;
    this.exporting.set(true);
    this.adminService.exportReport({ startDate: this.startDate, endDate: this.endDate }).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${this.startDate}-to-${this.endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
      },
    });
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
}
