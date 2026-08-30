import { Component, computed, input } from '@angular/core';

/** One cell: a value at the intersection of a row and a column. */
export interface HeatmapCell {
  row: number;
  column: number;
  value: number;
}

/** Steps of colour intensity. More than this and neighbouring cells stop reading apart. */
const INTENSITY_STEPS = 5;

/**
 * A row/column intensity grid.
 *
 * Deliberately not a canvas chart: a heatmap is a table of values, so rendering it
 * as an actual `<table>` gives correct semantics, keyboard access and screen
 * reader output for free, and needs no charting library. Intensity is carried by
 * background alpha, with the number in the cell title so the exact figure is
 * always reachable.
 */
@Component({
  selector: 'app-heatmap',
  standalone: true,
  template: `
    <table class="hm">
      @if (caption()) {
        <caption class="sr-only">
          {{
            caption()
          }}
        </caption>
      }
      <thead>
        <tr>
          <th scope="col"><span class="sr-only">Row</span></th>
          @for (label of columnLabels(); track $index) {
            <th scope="col" class="hm-col-label">{{ label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of grid(); track row.label) {
          <tr>
            <th scope="row" class="hm-row-label">{{ row.label }}</th>
            @for (cell of row.cells; track $index) {
              <td class="hm-cell" [style.--hm-intensity]="cell.intensity" [attr.title]="cell.title">
                <span class="sr-only">{{ cell.title }}</span>
              </td>
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
        overflow-x: auto;
      }

      .hm {
        border-collapse: separate;
        border-spacing: 2px;
        width: 100%;
      }

      .hm-col-label,
      .hm-row-label {
        color: var(--text-muted);
        font-size: 0.68rem;
        font-weight: 500;
        text-align: center;
        white-space: nowrap;
      }

      .hm-row-label {
        padding-right: 6px;
        text-align: right;
      }

      .hm-cell {
        height: 18px;
        min-width: 14px;
        border-radius: 3px;
        /* Alpha rather than a colour ramp: one hue keeps it legible for the most
           common forms of colour blindness. Comma-form rgba, because
           --primary-rgb is a comma-separated triplet and so cannot take the
           slash alpha syntax. */
        background: rgba(var(--primary-rgb), calc(var(--hm-intensity) * 0.9 + 0.06));
      }
    `,
  ],
})
export class HeatmapComponent {
  readonly cells = input<HeatmapCell[]>([]);
  readonly rowLabels = input<string[]>([]);
  readonly columnLabels = input<string[]>([]);
  readonly caption = input('');
  /**
   * What a value counts, used to phrase each cell.
   *
   * Without it a cell reads "Mon 14: 37", which does not say what 37 is.
   */
  readonly unit = input('');

  /** Busiest cell, which every other cell is shaded relative to. */
  private readonly peak = computed(() =>
    this.cells().reduce((max, cell) => Math.max(max, cell.value), 0),
  );

  protected readonly grid = computed(() => {
    const lookup = new Map<string, number>();
    for (const cell of this.cells()) {
      lookup.set(`${cell.row}:${cell.column}`, cell.value);
    }
    const peak = this.peak();
    const columns = this.columnLabels();

    return this.rowLabels().map((label, row) => ({
      label,
      cells: columns.map((columnLabel, column) => {
        const value = lookup.get(`${row}:${column}`) ?? 0;
        const unit = this.unit();
        return {
          label: columnLabel,
          value,
          title: `${label} ${columnLabel} — ${value}${unit ? ` ${unit}` : ''}`,
          // Quantised so the eye groups cells into bands instead of trying to
          // rank hundreds of near-identical shades.
          intensity: peak > 0 ? Math.round((value / peak) * INTENSITY_STEPS) / INTENSITY_STEPS : 0,
        };
      }),
    }));
  });
}
