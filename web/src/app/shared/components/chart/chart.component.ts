import {
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartDataset,
  type ChartType,
} from 'chart.js';
import { ChartColor, ChartKind, ChartSeries, ChartValueFormat } from './chart.types';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';

/**
 * Only the controllers, scales and plugins these charts use are registered.
 *
 * Chart.js is tree-shakeable, so registering the whole library would pull in
 * radar, polar area, bubble and scatter for no reason. This lands in the lazy
 * admin chunk, which is the only place charts are used.
 */
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

/** Order series are painted in when a caller does not name a colour. */
const PALETTE: ChartColor[] = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger'];

/** Above this many points, per-point markers become noise rather than detail. */
const POINT_HIDE_THRESHOLD = 45;

/**
 * One canvas chart, themed from the app's design tokens.
 *
 * Colours are read from CSS custom properties on the host rather than hard-coded,
 * so charts follow the palette and the dark theme without a second definition of
 * the brand colours.
 *
 * A canvas is invisible to assistive technology, so every chart also renders a
 * visually hidden table of the same numbers. That is the accessible equivalent,
 * not a nicety: without it the analytics screens would be unreadable to a screen
 * reader.
 */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: `
    <div class="chart-host" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel() || null"></canvas>
    </div>

    <table class="sr-only">
      <caption>
        {{
          ariaLabel() || 'Chart data'
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          @for (s of series(); track s.label) {
            <th scope="col">{{ s.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (label of labels(); track label; let i = $index) {
          <tr>
            <th scope="row">{{ label }}</th>
            @for (s of series(); track s.label) {
              <td>{{ s.data[i] }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .chart-host {
        position: relative;
        width: 100%;
      }
    `,
  ],
})
export class ChartComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly kind = input.required<ChartKind>();
  readonly labels = input<string[]>([]);
  readonly series = input<ChartSeries[]>([]);
  readonly height = input(240);
  readonly valueFormat = input<ChartValueFormat>('number');
  /** Shown to assistive technology and used as the hidden table's caption. */
  readonly ariaLabel = input('');
  readonly legend = input(false);
  /** Starts the value axis at zero. Off for trends where the range matters more. */
  readonly beginAtZero = input(true);
  /**
   * Strips axes, grid, tooltip and padding for use inline on a card.
   *
   * A sparkline carries shape, not values — the number it sits beside is the
   * value. Keeping the chrome at that size would crowd out the line itself.
   */
  readonly sparkline = input(false);

  private chart: Chart | null = null;

  /** Charts are decorative motion; a reduced-motion preference disables it. */
  private readonly animate = computed(() => {
    if (!this.isBrowser) return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  constructor() {
    // Rebuilds whenever inputs change. Chart.js mutates its own config, so
    // replacing the instance is more predictable than patching it in place.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const config = this.buildConfig();
      if (!this.isBrowser || !canvas) return;

      this.chart?.destroy();
      this.chart = new Chart(canvas, config);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private buildConfig(): ChartConfiguration {
    const kind = this.kind();
    const labels = this.labels();
    const series = this.series();
    const isDonut = kind === 'donut';

    return {
      type: this.chartType(kind),
      data: {
        labels,
        datasets: isDonut ? this.donutDatasets(series) : this.cartesianDatasets(kind, series),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: this.animate() ? undefined : false,
        // Nearest-in-x so hovering anywhere on a column reads the whole stack.
        interaction: { mode: isDonut ? 'nearest' : 'index', intersect: false },
        // A sparkline is drawn edge to edge; the default padding would leave it
        // floating in the middle of the card.
        layout: this.sparkline() ? { padding: 0 } : undefined,
        plugins: {
          legend: {
            display: this.legend() && !this.sparkline(),
            position: isDonut ? 'right' : 'top',
            labels: { color: this.token('--text-secondary'), boxWidth: 12, usePointStyle: true },
          },
          tooltip: {
            enabled: !this.sparkline(),
            backgroundColor: this.token('--text-primary'),
            titleColor: this.token('--surface'),
            bodyColor: this.token('--surface'),
            padding: 10,
            callbacks: {
              label: (ctx) => {
                // A donut parses to a bare number; cartesian charts to a point.
                const parsed = ctx.parsed as number | { y?: number };
                const value = typeof parsed === 'number' ? parsed : (parsed?.y ?? 0);
                const name = isDonut ? ctx.label : ctx.dataset.label;
                return `${name}: ${this.formatValue(value)}`;
              },
            },
          },
        },
        scales: isDonut
          ? undefined
          : this.sparkline()
            ? { x: { display: false }, y: { display: false } }
            : this.cartesianScales(kind),
      },
    };
  }

  private chartType(kind: ChartKind): ChartType {
    if (kind === 'donut') return 'doughnut';
    if (kind === 'line' || kind === 'area') return 'line';
    return 'bar';
  }

  private cartesianDatasets(kind: ChartKind, series: ChartSeries[]): ChartDataset[] {
    const dense = this.labels().length > POINT_HIDE_THRESHOLD || this.sparkline();

    return series.map((s, i) => {
      const color = this.token(`--${s.color ?? PALETTE[i % PALETTE.length]}`);
      const base = { label: s.label, data: s.data, borderColor: color };

      if (kind === 'line' || kind === 'area') {
        return {
          ...base,
          type: 'line' as const,
          backgroundColor: kind === 'area' ? this.translucent(color) : color,
          fill: kind === 'area',
          // Slight curve reads as a trend; a hard polyline reads as noise.
          tension: 0.35,
          borderWidth: 2,
          pointRadius: dense ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
        };
      }

      return { ...base, type: 'bar' as const, backgroundColor: color, borderWidth: 0 };
    });
  }

  private donutDatasets(series: ChartSeries[]): ChartDataset[] {
    // A donut has one dataset whose slices are the labels, so a caller passes a
    // single series and the colours come from the palette per slice.
    const first = series[0];
    if (!first) return [];
    return [
      {
        label: first.label,
        data: first.data,
        backgroundColor: first.data.map((_, i) => this.token(`--${PALETTE[i % PALETTE.length]}`)),
        borderColor: this.token('--surface'),
        borderWidth: 2,
      } as ChartDataset,
    ];
  }

  private cartesianScales(kind: ChartKind) {
    const grid = this.token('--border');
    const text = this.token('--text-muted');
    const stacked = kind === 'stacked-bar';

    return {
      x: {
        stacked,
        grid: { display: false },
        ticks: { color: text, maxRotation: 0, autoSkipPadding: 12 },
        border: { color: grid },
      },
      y: {
        stacked,
        beginAtZero: this.beginAtZero(),
        grid: { color: grid },
        ticks: { color: text, callback: (value: unknown) => this.formatValue(Number(value)) },
        border: { display: false },
      },
    };
  }

  /**
   * Resolves a design token to a concrete colour.
   *
   * Chart.js paints to a canvas and cannot resolve `var(--x)` itself, so the
   * value is read off the host at build time. Falls back to a mid grey when a
   * token is missing, which keeps a chart readable rather than invisible.
   */
  private token(name: string): string {
    if (!this.isBrowser) return '#888';
    const value = getComputedStyle(this.host.nativeElement).getPropertyValue(name).trim();
    return value || '#888';
  }

  /** Area fills need transparency; tokens are opaque. */
  private translucent(color: string): string {
    if (!this.isBrowser) return color;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return color;
    ctx.fillStyle = color;
    const resolved = ctx.fillStyle as string;
    if (!resolved.startsWith('#') || resolved.length !== 7) return color;
    const r = parseInt(resolved.slice(1, 3), 16);
    const g = parseInt(resolved.slice(3, 5), 16);
    const b = parseInt(resolved.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }

  private formatValue(value: number): string {
    switch (this.valueFormat()) {
      case 'currency':
        return `${CURRENCY_SYMBOL} ${this.compact(value)}`;
      case 'percent':
        return `${value}%`;
      default:
        return this.compact(value);
    }
  }

  /** Keeps axis labels short: 12.4k rather than 12,400. */
  private compact(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return `${Math.round(value * 100) / 100}`;
  }
}
