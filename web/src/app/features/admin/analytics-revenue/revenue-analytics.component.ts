import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import type { ChartSeries } from '../../../shared/components/chart/chart.types';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { AdminService, DateRange, RevenueAnalytics } from '../../../core/services/admin.service';
import { daysToMs } from '../../../core/utils/time';

interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'currency';
}

interface BreakdownRow {
  label: string;
  revenue: number;
  count: number;
  /** Share of total revenue, so rows are comparable at a glance. */
  pct: number;
  /** Revenue divided by transactions for this row. */
  avg: number;
}

interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

const DEFAULT_LOOKBACK_MS = daysToMs(30);

/** Turns a snake_case or SCREAMING_CASE key from the API into something readable. */
function humanise(key: string): string {
  if (!key) return 'Unknown';
  return key
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toRows(
  rows: { label: string; revenue: number; count: number }[],
  totalRevenue: number,
): BreakdownRow[] {
  return rows.map((r) => ({
    ...r,
    pct: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    avg: r.count > 0 ? r.revenue / r.count : 0,
  }));
}

@Component({
  selector: 'app-revenue-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, ChartComponent],
  templateUrl: './revenue-analytics.component.html',
  styleUrls: ['./revenue-analytics.component.scss'],
})
export class RevenueAnalyticsComponent implements OnInit {
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly loading = signal(true);
  readonly revenue = signal<RevenueAnalytics | null>(null);

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  readonly totalTransactions = computed(() =>
    (this.revenue()?.byPaymentMethod ?? []).reduce((sum, r) => sum + r.count, 0),
  );

  readonly metrics = computed<MetricCard[]>(() => {
    const rev = this.revenue();
    return [
      {
        label: 'Total Revenue',
        value: rev?.totalRevenue ?? 0,
        icon: 'payments',
        format: 'currency',
      },
      {
        label: 'Transactions',
        value: this.totalTransactions(),
        icon: 'receipt_long',
        format: 'number',
      },
      {
        label: 'Avg Order Value',
        value: rev?.avgOrderValue ?? 0,
        icon: 'shopping_cart',
        format: 'currency',
      },
      {
        label: 'Payment Methods',
        value: (rev?.byPaymentMethod ?? []).length,
        icon: 'credit_card',
        format: 'number',
      },
    ];
  });

  /**
   * Revenue and transaction count live on wildly different scales, so they get
   * separate charts rather than one chart with an unreadable second series.
   */
  readonly revenueChart = computed<ChartData>(() => {
    const points = this.revenue()?.revenueTimeSeries ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Revenue', data: points.map((p) => p.revenue), color: 'primary' }],
    };
  });

  readonly transactionsChart = computed<ChartData>(() => {
    const points = this.revenue()?.revenueTimeSeries ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Transactions', data: points.map((p) => p.count), color: 'secondary' }],
    };
  });

  readonly byPaymentMethod = computed<BreakdownRow[]>(() => {
    const rev = this.revenue();
    if (!rev) return [];
    return toRows(
      rev.byPaymentMethod.map((r) => ({
        label: humanise(r.method),
        revenue: r.revenue,
        count: r.count,
      })),
      rev.totalRevenue,
    );
  });

  readonly byPackageType = computed<BreakdownRow[]>(() => {
    const rev = this.revenue();
    if (!rev) return [];
    return toRows(
      rev.byPackageType.map((r) => ({
        label: humanise(r.type),
        revenue: r.revenue,
        count: r.count,
      })),
      rev.totalRevenue,
    );
  });

  readonly hasData = computed(
    () => (this.revenue()?.totalRevenue ?? 0) > 0 || this.totalTransactions() > 0,
  );

  /** The best single day in the range, worth calling out on a revenue page. */
  readonly bestDay = computed(() => {
    const points = this.revenue()?.revenueTimeSeries ?? [];
    if (points.length === 0) return null;
    return points.reduce((best, p) => (p.revenue > best.revenue ? p : best), points[0]);
  });

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    this.dateTo = now.toISOString().split('T')[0];
    this.dateFrom = new Date(now.getTime() - DEFAULT_LOOKBACK_MS).toISOString().split('T')[0];
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const range: DateRange = { startDate: this.dateFrom, endDate: this.dateTo };
    this.adminService.getRevenueAnalytics(range).subscribe({
      next: (data) => {
        this.revenue.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyDateRange(): void {
    this.loadData();
  }

  formatNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  }

  exportCSV(): void {
    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(','));

    add('Revenue Analytics Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('Note', 'Only completed payments are counted');
    add('');

    add('Metric', 'Value');
    for (const m of this.metrics()) add(m.label, m.value);
    add('');

    const rev = this.revenue();
    if (rev?.revenueTimeSeries?.length) {
      add('Revenue Over Time');
      add('Date', 'Revenue', 'Transactions');
      for (const p of rev.revenueTimeSeries) add(p.date, p.revenue, p.count);
      add('');
    }

    if (this.byPaymentMethod().length) {
      add('Revenue by Payment Method');
      add('Method', 'Revenue', 'Transactions', 'Share %', 'Avg Order Value');
      for (const r of this.byPaymentMethod()) {
        add(r.label, r.revenue, r.count, r.pct.toFixed(1), r.avg.toFixed(0));
      }
      add('');
    }

    if (this.byPackageType().length) {
      add('Revenue by Package Type');
      add('Type', 'Revenue', 'Transactions', 'Share %', 'Avg Order Value');
      for (const r of this.byPackageType()) {
        add(r.label, r.revenue, r.count, r.pct.toFixed(1), r.avg.toFixed(0));
      }
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-analytics-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
