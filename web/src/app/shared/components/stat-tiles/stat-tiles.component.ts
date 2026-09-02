import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** One figure to show. */
export interface StatTile {
  label: string;
  value: number;
  /** Material symbol name. */
  icon: string;
  /** Longer explanation, surfaced as a tooltip. */
  hint?: string;
  /** Draws attention to the figure that matters most, e.g. leads. */
  emphasis?: boolean;
}

/**
 * A responsive row of figures.
 *
 * Every screen that showed stats had its own copy of this markup and SCSS, which
 * is why the listings and shorts tabs did not look or behave the same. One
 * component means adding a figure is a one-line change everywhere.
 *
 * Collapses from a row to two columns on tablets and one per row on small
 * phones, so a long label never truncates and the numbers stay legible.
 */
@Component({
  selector: 'app-stat-tiles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-tiles.component.html',
  styleUrl: './stat-tiles.component.scss',
})
export class StatTilesComponent {
  readonly tiles = input.required<StatTile[]>();
  /** Smaller tiles, for sitting inside a card or table row. */
  readonly compact = input(false);
  /** Describes the group to screen readers. */
  readonly ariaLabel = input('Statistics');
}
