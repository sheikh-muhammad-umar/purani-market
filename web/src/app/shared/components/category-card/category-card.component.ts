import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * Category tile used in the browse grid.
 *
 * Lays the icon and label out horizontally: it gives long names like
 * "Electronics & Home Appliances" far more room than a narrow stacked tile, and
 * lets the grid use fewer, wider columns so the last row isn't left mostly
 * empty.
 *
 * Renders a router link when `link` is set, otherwise a button that emits
 * `selected` — the home page uses the button form to open the subcategory modal.
 */
@Component({
  selector: 'app-category-card',
  standalone: true,
  imports: [RouterLink, SkeletonComponent],
  template: `
    @if (loading()) {
      <div class="cc cc-loading" aria-hidden="true">
        <app-skeleton variant="circle" width="40px" />
        <app-skeleton variant="block" width="70%" height="0.8rem" />
      </div>
    } @else if (link()) {
      <a class="cc" [routerLink]="link()">
        <span class="cc-media">
          <img class="cc-icon" [src]="iconUrl()" [alt]="" loading="lazy" decoding="async" />
        </span>
        <span class="cc-text">
          <span class="cc-name">{{ name() }}</span>
          @if (subtitle()) {
            <span class="cc-subtitle">{{ subtitle() }}</span>
          }
        </span>
      </a>
    } @else {
      <button type="button" class="cc" (click)="selected.emit()">
        <span class="cc-media">
          <img class="cc-icon" [src]="iconUrl()" [alt]="" loading="lazy" decoding="async" />
        </span>
        <span class="cc-text">
          <span class="cc-name">{{ name() }}</span>
          @if (subtitle()) {
            <span class="cc-subtitle">{{ subtitle() }}</span>
          }
        </span>
      </button>
    }
  `,
  styles: [
    `
      /* No explicit height: an explicit cross-size cancels align-items: stretch,
         which is what keeps every tile in a grid row the same height. */
      :host {
        display: flex;
        min-width: 0;
      }

      .cc {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex: 1;
        min-width: 0;
        /* Fixed row height keeps one- and two-line labels identical in size */
        min-height: 64px;
        padding: var(--space-1);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        text-align: left;
        text-decoration: none;
        font-family: var(--font-body);
        cursor: pointer;
        transition:
          border-color var(--duration-base) var(--ease-out),
          background-color var(--duration-base) var(--ease-out),
          box-shadow var(--duration-base) var(--ease-out),
          transform var(--duration-base) var(--ease-out);
      }

      .cc:hover {
        border-color: var(--primary);
        box-shadow: var(--shadow-card);
        transform: translateY(-2px);
        color: var(--text-primary);
      }

      .cc-media {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: var(--radius-full);
        background: var(--surface-secondary);
        overflow: hidden;
        transition: transform var(--duration-base) var(--ease-out);
      }

      .cc:hover .cc-media {
        transform: scale(1.08);
      }

      .cc-icon {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .cc-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .cc-name {
        min-width: 0;
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        line-height: var(--leading-snug);
        letter-spacing: var(--tracking-normal);
        /* Two lines maximum, so an unusually long name can't stretch the row */
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .cc-subtitle {
        font-size: 11px;
        font-weight: var(--weight-normal);
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .cc-loading {
        cursor: default;
      }

      .cc-loading:hover {
        transform: none;
        box-shadow: none;
        border-color: var(--border);
      }

      @media (max-width: 767px) {
        .cc {
          min-height: 56px;
          gap: 6px;
          border-radius: var(--radius-sm);
        }

        .cc-media {
          width: 34px;
          height: 34px;
        }

        .cc-name {
          font-size: 11px;
        }
      }
    `,
  ],
})
export class CategoryCardComponent {
  /** Category display name. */
  readonly name = input('');

  /** Resolved icon URL. */
  readonly iconUrl = input('');

  /** Optional secondary line, e.g. a subcategory count. */
  readonly subtitle = input('');

  /** When set, the tile becomes a router link instead of a button. */
  readonly link = input('');

  /** Render a shimmer placeholder. */
  readonly loading = input(false);

  /** Emitted when the button form is activated. */
  readonly selected = output<void>();
}
