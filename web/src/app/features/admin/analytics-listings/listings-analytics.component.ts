import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import {
  AdminService,
  TimeSeriesPoint,
  CategoryAnalytics,
  DateRange,
  PriceTrendsData,
} from '../../../core/services/admin.service';
import { daysToMs } from '../../../core/utils/time';

interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'currency';
}

const DEFAULT_LOOKBACK_MS = daysToMs(30);

@Component({
  selector: 'app-listings-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  templateUrl: './listings-analytics.component.html',
  styleUrls: ['./listings-analytics.component.scss'],
})
export class ListingsAnalyticsComponent implements OnInit {
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly loading = signal(true);
  readonly metrics = signal<MetricCard[]>([]);
  readonly listingsTimeSeries = signal<TimeSeriesPoint[]>([]);
  readonly categoryAnalytics = signal<CategoryAnalytics[]>([]);
  readonly priceTrends = signal<PriceTrendsData | null>(null);

  readonly maxListingCount = computed(() =>
    Math.max(1, ...this.listingsTimeSeries().map((p) => p.value)),
  );

  readonly maxCategoryCount = computed(() =>
    Math.max(1, ...this.categoryAnalytics().map((c) => c.listingCount)),
  );

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    this.dateTo = now.toISOString().split('T')[0];
    this.dateFrom = new Date(now.getTime() - DEFAULT_LOOKBACK_MS).toISOString().split('T')[0];
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const dateRange: DateRange = { startDate: this.dateFrom, endDate: this.dateTo };

    this.adminService.getAnalytics(dateRange).subscribe({
      next: (data: any) => {
        const km = data?.metrics ?? data?.keyMetrics ?? {};
        const ts = data?.timeSeries ?? {};
        this.metrics.set([
          {
            label: 'Total Listings',
            value: km.totalListings ?? 0,
            icon: 'list_alt',
            format: 'number',
          },
          {
            label: 'Total Revenue',
            value: km.totalRevenue ?? 0,
            icon: 'payments',
            format: 'currency',
          },
          {
            label: 'Package Purchases',
            value: km.totalPurchases ?? km.totalPackagePurchases ?? 0,
            icon: 'shopping_cart',
            format: 'number',
          },
          {
            label: 'Conversations',
            value: km.totalConversations ?? 0,
            icon: 'chat',
            format: 'number',
          },
        ]);
        this.listingsTimeSeries.set(ts.listings ?? []);
        this.categoryAnalytics.set(data?.categoryAnalytics ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.adminService.getPriceTrends(dateRange).subscribe({
      next: (trends) => this.priceTrends.set(trends),
    });
  }

  applyDateRange(): void {
    this.loadData();
  }

  formatNumber(value: number): string {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  }

  exportCSV(): void {
    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(','));

    add('Listings Analytics Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('');

    // Metrics
    add('Metric', 'Value');
    for (const m of this.metrics()) {
      add(m.label, m.value);
    }
    add('');

    // Time series
    if (this.listingsTimeSeries().length > 0) {
      add('Listings Over Time');
      add('Date', 'Count');
      for (const p of this.listingsTimeSeries()) add(p.date, p.value);
      add('');
    }

    // Categories
    if (this.categoryAnalytics().length > 0) {
      add('Category Breakdown');
      add('Category', 'Listings');
      for (const c of this.categoryAnalytics()) add(c.categoryName, c.listingCount);
      add('');
    }

    // Price trends
    const pt = this.priceTrends();
    if (pt?.categories?.length) {
      add('Price Trends');
      add('Category', 'Avg Price', 'Change %', 'Direction');
      for (const c of pt.categories) add(c.categoryName, c.avgNewPrice, c.avgDiffPct, c.direction);
    }

    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listings-analytics-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
