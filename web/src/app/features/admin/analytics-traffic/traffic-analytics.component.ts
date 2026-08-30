import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import type { ChartSeries } from '../../../shared/components/chart/chart.types';
import { AdminService, DateRange, TrafficAnalytics } from '../../../core/services/admin.service';
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
  /** Share of the group total. */
  pct: number;
}

interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

const DEFAULT_LOOKBACK_MS = daysToMs(30);

/** Channel names carry meaning, so each gets a fixed icon rather than a colour alone. */
const CHANNEL_ICONS: Record<string, string> = {
  direct: 'link',
  'organic search': 'travel_explore',
  paid: 'ads_click',
  social: 'thumb_up',
  referral: 'share',
  email: 'mail',
  campaign: 'campaign',
};

function ranked(rows: { label: string; value: number }[]): RankedRow[] {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return rows.map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }));
}

@Component({
  selector: 'app-traffic-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, ChartComponent],
  templateUrl: './traffic-analytics.component.html',
  styleUrls: ['./traffic-analytics.component.scss'],
})
export class TrafficAnalyticsComponent implements OnInit {
  readonly loading = signal(true);
  readonly traffic = signal<TrafficAnalytics | null>(null);

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  readonly metrics = computed<MetricCard[]>(() => {
    const s = this.traffic()?.summary;
    return [
      { label: 'Sessions', value: this.compact(s?.sessions ?? 0), icon: 'timeline' },
      {
        label: 'Unique Visitors',
        value: this.compact(s?.uniqueVisitors ?? 0),
        icon: 'groups',
        hint: 'By browser id, so one person on two devices counts twice',
      },
      {
        label: 'Median Session',
        value: this.duration(s?.medianDurationSeconds ?? 0),
        icon: 'schedule',
        hint: 'Median, not average',
      },
      {
        label: 'Events per Session',
        value: String(s?.medianEventsPerSession ?? 0),
        icon: 'touch_app',
        hint: 'Median',
      },
    ];
  });

  readonly sessionsChart = computed<ChartData>(() => {
    const points = this.traffic()?.sessionsTimeSeries ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Sessions', data: points.map((p) => p.sessions), color: 'primary' }],
    };
  });

  readonly depthChart = computed<ChartData>(() => {
    const buckets = this.traffic()?.depthDistribution ?? [];
    return {
      labels: buckets.map((b) => b.bucket),
      series: [{ label: 'Sessions', data: buckets.map((b) => b.sessions), color: 'secondary' }],
    };
  });

  readonly channels = computed(() =>
    ranked(
      (this.traffic()?.byChannel ?? []).map((c) => ({ label: c.channel, value: c.sessions })),
    ).map((r) => ({ ...r, icon: CHANNEL_ICONS[r.label] ?? 'help' })),
  );

  readonly referrers = computed<RankedRow[]>(() =>
    ranked((this.traffic()?.topReferrers ?? []).map((r) => ({ label: r.host, value: r.sessions }))),
  );

  readonly landingPages = computed<RankedRow[]>(() =>
    ranked((this.traffic()?.landingPages ?? []).map((p) => ({ label: p.path, value: p.sessions }))),
  );

  readonly devices = computed<RankedRow[]>(() =>
    ranked((this.traffic()?.byDevice ?? []).map((d) => ({ label: d.device, value: d.sessions }))),
  );

  readonly browsers = computed<RankedRow[]>(() =>
    ranked((this.traffic()?.byBrowser ?? []).map((b) => ({ label: b.browser, value: b.sessions }))),
  );

  readonly operatingSystems = computed<RankedRow[]>(() =>
    ranked((this.traffic()?.byOs ?? []).map((o) => ({ label: o.os, value: o.sessions }))),
  );

  readonly connections = computed<RankedRow[]>(() =>
    ranked(
      (this.traffic()?.byConnection ?? []).map((c) => ({ label: c.connection, value: c.sessions })),
    ),
  );

  readonly visitorMix = computed<RankedRow[]>(() => {
    const s = this.traffic()?.summary;
    if (!s) return [];
    return ranked([
      { label: 'New visitors', value: s.newVisitors },
      { label: 'Returning visitors', value: s.returningVisitors },
    ]);
  });

  readonly signedInMix = computed<RankedRow[]>(() => {
    const s = this.traffic()?.signedInSessions;
    if (!s) return [];
    return ranked([
      { label: 'Signed in', value: s.authenticated },
      { label: 'Guest', value: s.guest },
    ]);
  });

  readonly campaigns = computed(() => this.traffic()?.campaigns ?? []);

  readonly hasSessions = computed(() => (this.traffic()?.summary?.sessions ?? 0) > 0);

  /**
   * Whether anything at all is known about where visits came from. Referrers and
   * campaign tags only appear once traffic arrives from outside, so an empty
   * state here is a normal early state rather than a fault.
   */
  readonly hasAcquisitionDetail = computed(
    () => this.referrers().length > 0 || this.campaigns().length > 0,
  );

  /** What share of recorded activity these numbers actually describe. */
  readonly coverageNote = computed(() => {
    const c = this.traffic()?.coverage;
    if (!c || c.totalEvents === 0) return '';
    const pct = Math.round((c.eventsWithSession / c.totalEvents) * 100);
    const parts = [
      `${c.eventsWithSession.toLocaleString()} of ${c.totalEvents.toLocaleString()} recorded events (${pct}%) carry a session, so these figures describe browser traffic rather than every event in the system.`,
    ];
    if (c.sessionsWithoutStart > 0) {
      parts.push(
        `${c.sessionsWithoutStart} session${c.sessionsWithoutStart === 1 ? '' : 's'} began before its opening event could be recorded, so it is counted in the session totals but not in the source and device breakdowns.`,
      );
    }
    return parts.join(' ');
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
    this.adminService.getTrafficAnalytics(range).subscribe({
      next: (data) => {
        this.traffic.set(data);
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

  /** Seconds as a readable span, because "4623s" tells a reader nothing. */
  duration(seconds: number): string {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
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

    add('Traffic and Acquisition Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('Timezone', this.traffic()?.timezone ?? '');
    add('');

    const t = this.traffic();
    if (t) {
      const c = t.coverage;
      add('Coverage');
      add('Total recorded events', c.totalEvents);
      add('Events carrying a session', c.eventsWithSession);
      add('Session start events', c.sessionStarts);
      add('Sessions without a recorded start', c.sessionsWithoutStart);
      add('');

      const s = t.summary;
      add('Summary');
      add('Sessions', s.sessions);
      add('Events in sessions', s.events);
      add('Unique visitors', s.uniqueVisitors);
      add('Median events per session', s.medianEventsPerSession);
      add('Median session duration (seconds)', s.medianDurationSeconds);
      add('New visitors', s.newVisitors);
      add('Returning visitors', s.returningVisitors);
      add('Sessions per visitor', s.sessionsPerVisitor);
      add('');

      section(
        'Sessions Over Time',
        ['Date', 'Sessions'],
        t.sessionsTimeSeries.map((p) => [p.date, p.sessions]),
      );
      section(
        'Session Depth',
        ['Events per session', 'Sessions'],
        t.depthDistribution.map((b) => [b.bucket, b.sessions]),
      );
      section(
        'Channels',
        ['Channel', 'Sessions', 'Share %'],
        this.channels().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Top Referrers',
        ['Host', 'Sessions', 'Share %'],
        this.referrers().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Campaigns',
        ['Source', 'Medium', 'Campaign', 'Sessions'],
        t.campaigns.map((c2) => [c2.source, c2.medium, c2.campaign, c2.sessions]),
      );
      section(
        'Landing Pages',
        ['Path', 'Sessions', 'Share %'],
        this.landingPages().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Devices',
        ['Device', 'Sessions', 'Share %'],
        this.devices().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Browsers',
        ['Browser', 'Sessions', 'Share %'],
        this.browsers().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Operating Systems',
        ['OS', 'Sessions', 'Share %'],
        this.operatingSystems().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Connection Types',
        ['Connection', 'Sessions', 'Share %'],
        this.connections().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Visitor Mix',
        ['Type', 'Visitors', 'Share %'],
        this.visitorMix().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
      section(
        'Signed In vs Guest Sessions',
        ['Type', 'Sessions', 'Share %'],
        this.signedInMix().map((r) => [r.label, r.value, r.pct.toFixed(1)]),
      );
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-analytics-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
