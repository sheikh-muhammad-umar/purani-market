import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import type { ChartSeries } from '../../../shared/components/chart/chart.types';
import {
  AdminService,
  DateRange,
  OtpAnalytics,
  RetentionAnalytics,
  SocialLoginAnalytics,
} from '../../../core/services/admin.service';
import { daysToMs } from '../../../core/utils/time';

interface MetricCard {
  label: string;
  value: number;
  icon: string;
  format: 'number' | 'percent';
  /** Shown under the value when the number does not follow the selected range. */
  note?: string;
}

interface FunnelStep {
  label: string;
  value: number;
  /** Share of the first step, so every bar is comparable. */
  pct: number;
  /** How many were lost since the previous step. Null on the first step. */
  dropOff: number | null;
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
const EMPTY_CHART: ChartData = { labels: [], series: [] };

/** Turns a snake_case or hyphenated key from the API into something readable. */
function humanise(key: string): string {
  if (!key) return 'Unknown';
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOtp\b/g, 'OTP')
    .replace(/\bSms\b/g, 'SMS')
    .replace(/\bWhatsapp\b/g, 'WhatsApp');
}

function ranked(rows: { label: string; value: number }[]): RankedRow[] {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return rows.map((r) => ({
    ...r,
    pct: total > 0 ? (r.value / total) * 100 : 0,
  }));
}

@Component({
  selector: 'app-users-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, ChartComponent],
  templateUrl: './users-analytics.component.html',
  styleUrls: ['./users-analytics.component.scss'],
})
export class UsersAnalyticsComponent implements OnInit {
  readonly loading = signal(true);
  readonly retention = signal<RetentionAnalytics | null>(null);
  readonly otp = signal<OtpAnalytics | null>(null);
  readonly social = signal<SocialLoginAnalytics | null>(null);

  dateFrom = '';
  dateTo = '';
  readonly today = new Date().toISOString().split('T')[0];

  readonly metrics = computed<MetricCard[]>(() => {
    const ret = this.retention();
    const otp = this.otp();
    const social = this.social();
    return [
      {
        label: 'Retention Rate',
        value: ret?.retentionRate ?? 0,
        icon: 'repeat',
        format: 'percent',
        note: 'last 30 days vs the 30 before',
      },
      {
        label: 'Churned Users',
        value: ret?.churnedUsers ?? 0,
        icon: 'person_off',
        format: 'number',
        note: 'last 30 days vs the 30 before',
      },
      {
        label: 'Social Logins',
        value: social?.totalSocialLogins ?? 0,
        icon: 'account_circle',
        format: 'number',
      },
      {
        label: 'OTP Success Rate',
        value: otp?.summary?.successRate ?? 0,
        icon: 'sms',
        format: 'percent',
      },
    ];
  });

  /** Daily active users: one point per calendar day in the reporting timezone. */
  readonly dauChart = computed<ChartData>(() => {
    const points = this.retention()?.dailyActiveUsers ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [{ label: 'Active users', data: points.map((p) => p.count), color: 'primary' }],
    };
  });

  readonly wauChart = computed<ChartData>(() => {
    const points = this.retention()?.weeklyActiveUsers ?? [];
    return {
      labels: points.map((p) => p.week.replace(/^\d{4}-/, '')),
      series: [{ label: 'Active users', data: points.map((p) => p.count), color: 'secondary' }],
    };
  });

  readonly mauChart = computed<ChartData>(() => {
    const points = this.retention()?.monthlyActiveUsers ?? [];
    return {
      labels: points.map((p) => p.month),
      series: [{ label: 'Active users', data: points.map((p) => p.count), color: 'accent' }],
    };
  });

  /**
   * Sent then verified. Failures are a leak out of the funnel rather than a
   * step in it, so they are reported beside the funnel, not inside it.
   */
  readonly otpFunnel = computed<FunnelStep[]>(() => {
    const s = this.otp()?.summary;
    if (!s) return [];
    const sent = s.totalSent;
    const steps = [
      { label: 'OTP sent', value: sent },
      { label: 'OTP verified', value: s.totalVerified },
    ];
    return steps.map((step, i) => ({
      ...step,
      pct: sent > 0 ? (step.value / sent) * 100 : 0,
      dropOff: i === 0 ? null : steps[i - 1].value - step.value,
    }));
  });

  readonly otpChart = computed<ChartData>(() => {
    const points = this.otp()?.timeSeries ?? [];
    return {
      labels: points.map((p) => p.date.slice(5)),
      series: [
        // A day with no events of a kind omits the key entirely, so treat a
        // missing value as zero rather than letting it break the line.
        { label: 'Sent', data: points.map((p) => p.otp_sent ?? 0), color: 'primary' },
        { label: 'Verified', data: points.map((p) => p.otp_verified ?? 0), color: 'success' },
      ],
    };
  });

  /**
   * Every OTP event type: sent, verified, failed, resent, expired, plus the
   * WhatsApp sends. These are stages and outcomes, not competing categories, so
   * bars scale against the largest count and no share percentage is shown —
   * there is no denominator that would make one true.
   */
  readonly otpEvents = computed<RankedRow[]>(() => {
    const rows = this.otp()?.actionBreakdown ?? [];
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({
      label: humanise(r.action),
      value: r.count,
      pct: (r.count / max) * 100,
    }));
  });

  readonly otpByChannel = computed<RankedRow[]>(() =>
    ranked(
      (this.otp()?.channelBreakdown ?? []).map((c) => ({
        label: humanise(c.channel),
        value: c.count,
      })),
    ),
  );

  /**
   * Email and phone verification overlap — a user can have both — so these are
   * three independent counts, not slices of a whole. Percentages are omitted
   * for that reason.
   */
  readonly verificationRows = computed(() => {
    const v = this.otp()?.userVerificationStatus;
    if (!v) return [];
    const max = Math.max(1, v.emailVerified, v.phoneVerified, v.unverified);
    return [
      { label: 'Email verified', value: v.emailVerified, pct: (v.emailVerified / max) * 100 },
      { label: 'Phone verified', value: v.phoneVerified, pct: (v.phoneVerified / max) * 100 },
      { label: 'Not verified', value: v.unverified, pct: (v.unverified / max) * 100 },
    ];
  });

  readonly socialByProvider = computed<RankedRow[]>(() =>
    ranked(
      (this.social()?.byProvider ?? []).map((p) => ({
        label: humanise(p.provider),
        value: p.count,
      })),
    ),
  );

  readonly socialChart = computed<ChartData>(() => {
    const points = this.social()?.timeSeries ?? [];
    if (points.length === 0) return EMPTY_CHART;
    const providers: { key: 'google' | 'facebook' | 'apple'; label: string }[] = [
      { key: 'google', label: 'Google' },
      { key: 'facebook', label: 'Facebook' },
      { key: 'apple', label: 'Apple' },
    ];
    const colors = ['primary', 'secondary', 'accent'] as const;
    return {
      labels: points.map((p) => p.date.slice(5)),
      // Drop providers with no logins at all: an always-zero line is just noise.
      series: providers
        .map((provider, i) => ({
          label: provider.label,
          data: points.map((p) => p[provider.key] ?? 0),
          color: colors[i],
        }))
        .filter((s) => s.data.some((v) => v > 0)),
    };
  });

  readonly socialNewVsReturning = computed<RankedRow[]>(() => {
    const nvr = this.social()?.newVsReturning;
    if (!nvr) return [];
    return ranked([
      { label: 'New users', value: nvr.newUsers },
      { label: 'Returning users', value: nvr.returningUsers },
    ]);
  });

  readonly hasSocialData = computed(() => (this.social()?.totalSocialLogins ?? 0) > 0);
  readonly hasOtpData = computed(() => (this.otp()?.summary?.totalSent ?? 0) > 0);

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
    let pending = 3;
    const settle = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };

    this.adminService.getRetentionAnalytics(range).subscribe({
      next: (data) => {
        this.retention.set(data);
        settle();
      },
      error: settle,
    });
    this.adminService.getOtpAnalytics(range).subscribe({
      next: (data) => {
        this.otp.set(data);
        settle();
      },
      error: settle,
    });
    this.adminService.getSocialLoginAnalytics(range).subscribe({
      next: (data) => {
        this.social.set(data);
        settle();
      },
      error: settle,
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

    add('Users Analytics Report');
    add('Date Range', `${this.dateFrom} to ${this.dateTo}`);
    add('');

    add('Metric', 'Value', 'Note');
    for (const m of this.metrics()) {
      add(m.label, m.format === 'percent' ? `${m.value}%` : m.value, m.note ?? '');
    }
    add('');

    const ret = this.retention();
    if (ret?.dailyActiveUsers?.length) {
      add('Daily Active Users');
      add('Date', 'Active Users');
      for (const p of ret.dailyActiveUsers) add(p.date, p.count);
      add('');
    }
    if (ret?.weeklyActiveUsers?.length) {
      add('Weekly Active Users');
      add('Week', 'Active Users');
      for (const p of ret.weeklyActiveUsers) add(p.week, p.count);
      add('');
    }
    if (ret?.monthlyActiveUsers?.length) {
      add('Monthly Active Users');
      add('Month', 'Active Users');
      for (const p of ret.monthlyActiveUsers) add(p.month, p.count);
      add('');
    }

    const otp = this.otp();
    if (otp) {
      add('OTP Funnel');
      add('Step', 'Count', 'Share of Sent %', 'Dropped');
      for (const step of this.otpFunnel()) {
        add(step.label, step.value, step.pct.toFixed(1), step.dropOff ?? '');
      }
      add('OTP failed', otp.summary.totalFailed);
      add('');

      if (otp.timeSeries?.length) {
        add('OTP Over Time');
        add('Date', 'Sent', 'Verified');
        for (const p of otp.timeSeries) add(p.date, p.otp_sent ?? 0, p.otp_verified ?? 0);
        add('');
      }
      if (this.otpEvents().length) {
        add('OTP Events');
        add('Event', 'Count');
        for (const r of this.otpEvents()) add(r.label, r.value);
        add('');
      }
      if (this.otpByChannel().length) {
        add('OTP by Channel');
        add('Channel', 'Count', 'Share %');
        for (const r of this.otpByChannel()) add(r.label, r.value, r.pct.toFixed(1));
        add('');
      }
      add('Account Verification');
      add('Status', 'Users');
      for (const r of this.verificationRows()) add(r.label, r.value);
      add('');
    }

    const social = this.social();
    if (social) {
      add('Social Logins');
      add('Total', social.totalSocialLogins);
      add('Provider', 'Logins', 'Share %');
      for (const r of this.socialByProvider()) add(r.label, r.value, r.pct.toFixed(1));
      add('');
      add('New vs Returning');
      for (const r of this.socialNewVsReturning()) add(r.label, r.value, r.pct.toFixed(1));
      add('');
      if (social.timeSeries?.length) {
        add('Social Logins Over Time');
        add('Date', 'Google', 'Facebook', 'Apple');
        for (const p of social.timeSeries) add(p.date, p.google, p.facebook, p.apple);
      }
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-analytics-${this.dateFrom}-to-${this.dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
