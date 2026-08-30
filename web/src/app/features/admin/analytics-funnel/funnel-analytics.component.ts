import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import type { ChartSeries } from '../../../shared/components/chart/chart.types';
import {
  AdminService,
  DateRange,
  ListingFunnelAnalytics,
} from '../../../core/services/admin.service';
import { daysToMs } from '../../../core/utils/time';

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  hint?: string;
}

interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

const DEFAULT_LOOKBACK_MS = daysToMs(30);

@Component({
  selector: 'app-funnel-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, ChartComponent],
  templateUrl: './funnel-analytics.component.html',
  styleUrls: ['./funnel-analytics.component.scss'],
})
export class FunnelAnalyticsComponent implements OnInit {
  readonly loading = signal(true);
  readonly data = signal<ListingFunnelAnalytics | null>(null);

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  readonly funnel = computed(() => this.data()?.funnel ?? []);
  readonly topListings = computed(() => this.data()?.topListings ?? []);
  readonly byCategory = computed(() => this.data()?.byCategory ?? []);

  readonly metrics = computed<MetricCard[]>(() => {
    const d = this.data();
    const rates = d?.conversionRates;
    const totals = d?.eventTotals;
    return [
      {
        label: 'Listings Viewed',
        value: this.compact(d?.funnel?.[0]?.listings ?? 0),
        icon: 'visibility',
        hint: `${this.compact(totals?.views ?? 0)} views in total`,
      },
      {
        label: 'View to Contact',
        value: `${rates?.viewToContact ?? 0}%`,
        icon: 'call',
        hint: 'Share of viewed listings that got a contact',
      },
      {
        label: 'Contact to Chat',
        value: `${rates?.contactToConversation ?? 0}%`,
        icon: 'forum',
        hint: 'Of contacted listings',
      },
      {
        label: 'Saved Listings',
        value: this.compact(totals?.savedListings ?? 0),
        icon: 'favorite',
        hint: 'Not a funnel stage — saving is optional',
      },
    ];
  });

  readonly trendChart = computed<ChartData>(() => {
    const points = this.data()?.trend ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Views', data: points.map((p) => p.views), color: 'primary' }],
    };
  });

  /**
   * Contacts get their own chart. Views run in the thousands and contacts in
   * single digits, so on one axis the contact line would sit flat on zero.
   */
  readonly contactsChart = computed<ChartData>(() => {
    const points = this.data()?.trend ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Contacts', data: points.map((p) => p.contacts), color: 'accent' }],
    };
  });

  readonly hasContacts = computed(() => (this.data()?.trend ?? []).some((p) => p.contacts > 0));

  readonly hasData = computed(() => (this.data()?.funnel?.[0]?.listings ?? 0) > 0);

  /**
   * Conversations the funnel could not attribute. Surfaced rather than folded
   * in, because each cause needs a different fix.
   */
  readonly attributionNotes = computed<string[]>(() => {
    const a = this.data()?.attribution;
    if (!a || a.conversationsInRange === 0) return [];
    const notes: string[] = [];
    if (a.conversationsWithoutListing > 0) {
      notes.push(
        `${a.conversationsWithoutListing} of ${a.conversationsInRange} conversations in this range are not linked to a listing, so they cannot appear in the funnel.`,
      );
    }
    if (a.conversationsOnUncontactedListings > 0) {
      notes.push(
        `${a.conversationsOnUncontactedListings} started on a listing with no recorded contact event, which usually means the chat began somewhere other than the listing's contact button.`,
      );
    }
    return notes;
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
    this.adminService.getListingFunnelAnalytics(range).subscribe({
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

  /** Views per unique viewer, to expose a listing inflated by refreshes. */
  viewsPerViewer(views: number, uniqueViewers: number): string {
    if (uniqueViewers <= 0) return '—';
    return (views / uniqueViewers).toFixed(1);
  }

  exportCSV(): void {
    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(','));

    add('Listing Funnel Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('Timezone', this.data()?.timezone ?? '');
    add('Unit', 'One listing, stages strictly nested');
    add('');

    const d = this.data();
    if (d) {
      add('Funnel');
      add('Stage', 'Listings', 'Share of viewed %', 'Dropped');
      for (const s of d.funnel) add(s.stage, s.listings, s.pct, s.dropOff ?? '');
      add('');

      add('Conversion Rates');
      add('View to contact %', d.conversionRates.viewToContact);
      add('Contact to conversation %', d.conversionRates.contactToConversation);
      add('View to conversation %', d.conversionRates.viewToConversation);
      add('');

      add('Event Totals');
      add('Views', d.eventTotals.views);
      add('Contacts', d.eventTotals.contacts);
      add('Favorites', d.eventTotals.favorites);
      add('Conversations counted in funnel', d.eventTotals.conversations);
      add('Listings saved at least once', d.eventTotals.savedListings);
      add('');

      add('Attribution');
      add('Conversations in range', d.attribution.conversationsInRange);
      add('Not linked to a listing', d.attribution.conversationsWithoutListing);
      add('On listings with no contact event', d.attribution.conversationsOnUncontactedListings);
      add('');

      if (d.trend.length) {
        add('Views and Contacts Over Time');
        add('Date', 'Views', 'Contacts');
        for (const p of d.trend) add(p.date, p.views, p.contacts);
        add('');
      }

      if (d.topListings.length) {
        add('Top Listings by Views');
        add('Listing', 'Views', 'Unique Viewers', 'Views per Viewer', 'Contacts', 'Saves', 'Chats');
        for (const l of d.topListings) {
          add(
            l.title,
            l.views,
            l.uniqueViewers,
            this.viewsPerViewer(l.views, l.uniqueViewers),
            l.contacts,
            l.favorites,
            l.conversations,
          );
        }
        add('');
      }

      if (d.byCategory.length) {
        add('By Category');
        add('Category', 'Listings', 'Views', 'Contacts', 'Chats', 'View to Contact %');
        for (const c of d.byCategory) {
          add(c.categoryName, c.listings, c.views, c.contacts, c.conversations, c.viewToContact);
        }
      }
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listing-funnel-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
