import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AnalyticsData,
  MetricsSummary,
  TimeSeriesPoint,
  CategoryAnalytics,
  DateRange,
} from '../../../core/services/admin.service';

export interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'currency';
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
})
export class AnalyticsDashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly metrics = signal<MetricsSummary | null>(null);
  readonly timeSeries = signal<{ registrations: TimeSeriesPoint[]; listings: TimeSeriesPoint[]; conversations: TimeSeriesPoint[]; purchases: TimeSeriesPoint[] } | null>(null);
  readonly categoryAnalytics = signal<CategoryAnalytics[]>([]);

  startDate = '';
  endDate = '';

  readonly metricCards = computed<MetricCard[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      { label: 'Total Users', value: m.totalUsers, icon: '👥', format: 'number' },
      { label: 'Active Users (30d)', value: m.activeUsers, icon: '🟢', format: 'number' },
      { label: 'Total Listings', value: m.totalListings, icon: '📋', format: 'number' },
      { label: 'Conversations', value: m.totalConversations, icon: '💬', format: 'number' },
      { label: 'Purchases', value: m.totalPurchases, icon: '🛒', format: 'number' },
      { label: 'Revenue', value: m.totalRevenue, icon: '💰', format: 'currency' },
    ];
  });

  readonly maxCategoryCount = computed(() => {
    const cats = this.categoryAnalytics();
    if (cats.length === 0) return 1;
    return Math.max(...cats.map(c => c.listingCount), 1);
  });

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.startDate = this.formatDateInput(thirtyDaysAgo);
    this.endDate = this.formatDateInput(now);
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading.set(true);
    this.error.set(null);
    const dateRange: DateRange | undefined =
      this.startDate && this.endDate
        ? { startDate: this.startDate, endDate: this.endDate }
        : undefined;

    this.adminService.getAnalytics(dateRange).subscribe({
      next: (data: AnalyticsData) => {
        this.metrics.set(data.metrics);
        this.timeSeries.set(data.timeSeries);
        this.categoryAnalytics.set(data.categoryAnalytics);
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
      return `Rs ${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }

  getBarWidth(count: number): number {
    return (count / this.maxCategoryCount()) * 100;
  }

  getMaxTimeSeriesValue(points: TimeSeriesPoint[]): number {
    if (!points || points.length === 0) return 1;
    return Math.max(...points.map(p => p.value), 1);
  }

  getBarHeight(value: number, max: number): number {
    return (value / max) * 100;
  }

  formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  private formatDateInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
