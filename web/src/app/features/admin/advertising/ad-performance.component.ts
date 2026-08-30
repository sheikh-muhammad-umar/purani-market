import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { AdConversionRow, AdPerformanceReport } from '../../../core/models';

/** Turns a stored action name into something readable in the report. */
function humaniseAction(action: string): string {
  return action.replace(/_/g, ' ');
}

/** Selectable reporting windows, in days. */
const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

/**
 * Delivery reporting for advertising.
 *
 * Built from the recorded event rows rather than the lifetime counters on each
 * campaign, so it can answer "how did last week go" instead of only "how much
 * has this campaign ever delivered".
 */
@Component({
  selector: 'app-ad-performance',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent],
  templateUrl: './ad-performance.component.html',
  styleUrls: ['./advertising-admin.scss'],
})
export class AdPerformanceComponent implements OnInit, OnDestroy {
  readonly rangeOptions = RANGE_OPTIONS;

  readonly report = signal<AdPerformanceReport | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly error = signal('');
  readonly selectedDays = signal(30);

  /**
   * Impressions and clicks per day.
   *
   * Both on one chart because the interesting question is whether clicks track
   * delivery; on separate charts that comparison has to be done by eye.
   */
  readonly dailyChart = computed(() => {
    const daily = this.report()?.daily ?? [];
    return {
      labels: daily.map((row) => row.date.slice(5)),
      series: [
        {
          label: 'Impressions',
          data: daily.map((row) => row.impressions),
          color: 'primary' as const,
        },
        { label: 'Clicks', data: daily.map((row) => row.clicks), color: 'accent' as const },
      ],
    };
  });

  /** Tallest daily bar, used to scale the chart. */
  readonly peakImpressions = computed(() => {
    const daily = this.report()?.daily ?? [];
    return daily.reduce((max, row) => Math.max(max, row.impressions), 0);
  });

  /**
   * The actions that count as a conversion, in prose.
   *
   * Named in the UI rather than left implicit, because "converted" means nothing
   * to whoever reads this report unless they know what was counted.
   */
  readonly conversionActionLabels = computed(() =>
    (this.report()?.conversions.countedActions ?? []).map(humaniseAction).join(', '),
  );

  /** e.g. `contact x3, favourite x1` */
  followedLabel(row: AdConversionRow): string {
    return row.actions.map((a) => `${humaniseAction(a.action)} x${a.count}`).join(', ');
  }

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly advertising: AdvertisingService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectRange(days: number): void {
    if (days === this.selectedDays()) return;
    this.selectedDays.set(days);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const to = new Date();
    const from = new Date(to.getTime() - (this.selectedDays() - 1) * 24 * 60 * 60 * 1000);

    this.advertising
      .getPerformance(from.toISOString(), to.toISOString())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.loading.set(false);
          this.loadFailed.set(false);
        },
        error: () => {
          this.error.set('Could not load the performance report.');
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Bar height as a percentage of the peak day. */
  barHeight(impressions: number): number {
    const peak = this.peakImpressions();
    if (peak <= 0) return 0;
    return Math.max(2, Math.round((impressions / peak) * 100));
  }
}
