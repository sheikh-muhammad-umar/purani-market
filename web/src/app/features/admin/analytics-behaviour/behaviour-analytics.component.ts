import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import type { ChartSeries } from '../../../shared/components/chart/chart.types';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { AdminService, BehaviourAnalytics, DateRange } from '../../../core/services/admin.service';
import { daysToMs } from '../../../core/utils/time';

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  hint?: string;
}

interface RankedRow {
  label: string;
  value: number;
  pct: number;
}

interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

const DEFAULT_LOOKBACK_MS = daysToMs(30);

/** Filter keys arrive as camelCase parameter names. */
function humaniseFilter(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Purchase statuses arrive lowercase from the store. */
function humaniseStatus(status: string): string {
  return status.replace(/^\w/, (c) => c.toUpperCase());
}

function ranked(rows: { label: string; value: number }[]): RankedRow[] {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
}

@Component({
  selector: 'app-behaviour-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, ChartComponent],
  templateUrl: './behaviour-analytics.component.html',
  styleUrls: ['./behaviour-analytics.component.scss'],
})
export class BehaviourAnalyticsComponent implements OnInit {
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly loading = signal(true);
  readonly data = signal<BehaviourAnalytics | null>(null);

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  readonly metrics = computed<MetricCard[]>(() => {
    const d = this.data();
    return [
      {
        label: 'Page Views',
        value: this.compact(d?.pageViewsTracked ?? 0),
        icon: 'description',
      },
      {
        label: 'Filters Applied',
        value: this.compact(d?.filterUsage?.withFilters ?? 0),
        icon: 'filter_list',
        hint: `${d?.filterUsage?.cleared ?? 0} cleared instead`,
      },
      {
        label: 'Purchase Completion',
        value: `${d?.purchaseSummary?.completionRate ?? 0}%`,
        icon: 'shopping_cart_checkout',
        hint: `${d?.purchaseSummary?.completed ?? 0} of ${d?.purchaseSummary?.total ?? 0}`,
      },
      {
        label: 'Empty Package Shelf',
        value: `${d?.packageBrowsing?.emptyShelfRate ?? 0}%`,
        icon: 'production_quantity_limits',
        hint: 'Browses that found nothing to buy',
      },
    ];
  });

  // Pages
  readonly topPages = computed<RankedRow[]>(() =>
    ranked((this.data()?.topPages ?? []).map((p) => ({ label: p.path, value: p.views }))),
  );
  readonly pageSections = computed<RankedRow[]>(() =>
    ranked((this.data()?.pageSections ?? []).map((p) => ({ label: p.section, value: p.views }))),
  );

  // Filters
  readonly topFilters = computed<RankedRow[]>(() =>
    ranked(
      (this.data()?.topFilters ?? []).map((f) => ({
        label: humaniseFilter(f.key),
        value: f.uses,
      })),
    ),
  );

  readonly filterCountChart = computed<ChartData>(() => {
    const rows = this.data()?.filtersByCount ?? [];
    return {
      labels: rows.map((r) => (r.filterCount === 0 ? 'none' : String(r.filterCount))),
      series: [{ label: 'Searches', data: rows.map((r) => r.applies), color: 'secondary' }],
    };
  });

  // Geography
  readonly cities = computed<RankedRow[]>(() =>
    ranked((this.data()?.viewsByCity ?? []).map((c) => ({ label: c.city, value: c.views }))),
  );
  readonly cityRows = computed(() => this.data()?.viewsByCity ?? []);

  /** Views per viewed listing, which exposes a city carried by a single item. */
  viewsPerListing(views: number, listings: number): string {
    if (listings <= 0) return '—';
    return (views / listings).toFixed(1);
  }

  // Purchases
  readonly purchaseOutcomes = computed(() => this.data()?.purchaseOutcomes ?? []);

  readonly hasFilterData = computed(() => (this.data()?.filterUsage?.applies ?? 0) > 0);
  readonly hasPageData = computed(() => (this.data()?.pageViewsTracked ?? 0) > 0);
  readonly hasCityData = computed(() => (this.data()?.viewsByCity ?? []).length > 0);
  readonly hasPurchaseData = computed(() => (this.data()?.purchaseSummary?.total ?? 0) > 0);
  readonly hasPackageBrowsing = computed(() => (this.data()?.packageBrowsing?.listViewed ?? 0) > 0);

  /**
   * Steps the purchase journey intends to record but currently does not, so an
   * absent stage reads as missing instrumentation rather than as no activity.
   */
  readonly missingTracking = computed<string[]>(() => {
    const t = this.data()?.tracking;
    if (!t) return [];
    const gaps: string[] = [];
    if (!t.purchaseCtaEventsRecorded) gaps.push('purchase button clicks');
    if (!t.paymentAttemptEventsRecorded) gaps.push('payment attempts');
    if (!t.packagePurchaseEventsRecorded) gaps.push('completed purchase events');
    return gaps;
  });

  /**
   * Built in TypeScript rather than with an inline @for, which rendered the list
   * as "completed purchase events , but no such events" — the loop's whitespace
   * lands before the following punctuation.
   */
  readonly missingTrackingNote = computed(() => {
    const gaps = this.missingTracking();
    if (gaps.length === 0) return '';
    const list =
      gaps.length === 1 ? gaps[0] : `${gaps.slice(0, -1).join(', ')} and ${gaps[gaps.length - 1]}`;
    return (
      `The purchase journey is meant to record ${list}, but no such events exist in this range. ` +
      'Until they are emitted, the steps between opening a package list and a purchase record ' +
      'appearing cannot be measured, which is why they are absent above rather than shown as zero.'
    );
  });

  /**
   * Relative to the busiest city rather than a share of the total: the endpoint
   * caps the list at 25 cities, so a share would divide by a partial total and
   * quietly overstate every row.
   */
  cityShare(views: number): number {
    const top = this.cityRows()[0]?.views ?? 0;
    return top > 0 ? (views / top) * 100 : 0;
  }

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
    this.adminService.getBehaviourAnalytics(range).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyDateRange(): void {
    this.loadData();
  }

  compact(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  }

  statusLabel(status: string): string {
    return humaniseStatus(status);
  }

  exportCSV(): void {
    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(','));
    const section = (title: string, header: string[], rows: (string | number)[][]) => {
      if (rows.length === 0) return;
      add(title);
      add(...header);
      for (const row of rows) add(...row);
      add('');
    };

    add('Behaviour Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('Timezone', this.data()?.timezone ?? '');
    add('');

    const d = this.data();
    if (d) {
      section(
        'Top Pages',
        ['Path', 'Views'],
        d.topPages.map((p) => [p.path, p.views]),
      );
      section(
        'Page Sections',
        ['Section', 'Views'],
        d.pageSections.map((p) => [p.section, p.views]),
      );

      add('Filter Usage');
      add('Filter interactions', d.filterUsage.applies);
      add('With at least one filter', d.filterUsage.withFilters);
      add('Cleared filters', d.filterUsage.cleared);
      add('Filter rate %', d.filterUsage.filterRate);
      add('');

      section(
        'Filters per Search',
        ['Filter count', 'Searches'],
        d.filtersByCount.map((f) => [f.filterCount, f.applies]),
      );
      section(
        'Most Used Filters',
        ['Filter', 'Uses'],
        d.topFilters.map((f) => [humaniseFilter(f.key), f.uses]),
      );
      section(
        'Views by Listing City',
        ['City', 'Views', 'Listings Viewed', 'Views per Listing'],
        d.viewsByCity.map((c) => [
          c.city,
          c.views,
          c.listings,
          this.viewsPerListing(c.views, c.listings),
        ]),
      );

      add('Package Browsing');
      add('Package list views', d.packageBrowsing.listViewed);
      add('Found nothing available', d.packageBrowsing.noneAvailable);
      add('Empty shelf rate %', d.packageBrowsing.emptyShelfRate);
      add('Purchase button clicks', d.packageBrowsing.ctaClicked);
      add('Purchases initiated', d.packageBrowsing.purchaseInitiated);
      add('Payment attempts', d.packageBrowsing.paymentAttempts);
      add('');

      section(
        'Purchase Outcomes',
        ['Status', 'Purchases', 'Share %', 'Value'],
        d.purchaseOutcomes.map((p) => [humaniseStatus(p.status), p.purchases, p.pct, p.amount]),
      );

      if (this.missingTracking().length) {
        add('Not Yet Tracked');
        for (const gap of this.missingTracking()) add(gap);
      }
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behaviour-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
