/** Shapes the admin analytics actually need. */
export type ChartKind = 'line' | 'area' | 'bar' | 'stacked-bar' | 'donut';

/** Design-token names a series may be painted with. */
export type ChartColor = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';

export interface ChartSeries {
  label: string;
  data: number[];
  /**
   * Which token to paint with. Omitted series are assigned from the palette in
   * order, so a caller only names a colour when the meaning demands one — a
   * failure series in `danger`, for example.
   */
  color?: ChartColor;
}

/** How to render values in tooltips and on the value axis. */
export type ChartValueFormat = 'number' | 'currency' | 'percent';
