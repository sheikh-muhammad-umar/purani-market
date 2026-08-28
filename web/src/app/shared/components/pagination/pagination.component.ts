import { Component, computed, input, output } from '@angular/core';

/**
 * Page navigation with a windowed page list.
 *
 * Replaces the prev/next pairs duplicated across search, favourites, my-listings
 * and the admin tables. Page numbers are shown from tablet width up; narrow
 * screens fall back to a compact "Page X of Y" label so the control never wraps.
 *
 * Usage:
 *   <app-pagination
 *     [currentPage]="page()"
 *     [totalPages]="totalPages()"
 *     (pageChange)="loadPage($event)" />
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (totalPages() > 1) {
      <nav class="pg" [attr.aria-label]="label()">
        <button
          type="button"
          class="pg-arrow"
          [disabled]="currentPage() <= 1"
          (click)="go(currentPage() - 1)"
          aria-label="Previous page"
        >
          <span class="material-symbols-rounded pg-arrow-icon" aria-hidden="true"
            >chevron_left</span
          >
          <span class="pg-arrow-text">Previous</span>
        </button>

        <ol class="pg-list">
          @for (item of pages(); track $index) {
            @if (item === null) {
              <li class="pg-gap" aria-hidden="true">…</li>
            } @else {
              <li>
                <button
                  type="button"
                  class="pg-page"
                  [class.is-current]="item === currentPage()"
                  [attr.aria-current]="item === currentPage() ? 'page' : null"
                  [attr.aria-label]="'Page ' + item"
                  (click)="go(item)"
                >
                  {{ item }}
                </button>
              </li>
            }
          }
        </ol>

        <!-- Not aria-hidden: this and .pg-list are never exposed at the same
             time, since each is display:none at the other's breakpoint. Hiding
             it left narrow viewports with no announced page position. -->
        <p class="pg-compact">Page {{ currentPage() }} of {{ totalPages() }}</p>

        <button
          type="button"
          class="pg-arrow"
          [disabled]="currentPage() >= totalPages()"
          (click)="go(currentPage() + 1)"
          aria-label="Next page"
        >
          <span class="pg-arrow-text">Next</span>
          <span class="material-symbols-rounded pg-arrow-icon" aria-hidden="true"
            >chevron_right</span
          >
        </button>
      </nav>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* One shared control height and type scale for every child, so the arrows
         and the numbers read as one set. Previously the arrows inherited
         .btn-sm at 12px while the numbers were 14px, and a 36px box at
         --radius-sm looked like a rounded square beside the wider pills. */
      .pg {
        --pg-size: 38px;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-1);
        flex-wrap: wrap;
        padding: var(--space-3) 0;
      }

      .pg-arrow,
      .pg-page {
        height: var(--pg-size);
        border-radius: var(--radius-full);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        cursor: pointer;
        transition:
          background-color var(--duration-base) var(--ease-out),
          border-color var(--duration-base) var(--ease-out),
          color var(--duration-base) var(--ease-out),
          transform var(--duration-fast) var(--ease-out);
      }

      /* ---- Prev / Next ---- */
      .pg-arrow {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        padding: 0 var(--space-2);
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-primary);
      }

      .pg-arrow:hover:not(:disabled) {
        border-color: var(--primary);
        color: var(--primary);
        background: var(--primary-subtle);
      }

      .pg-arrow:active:not(:disabled) {
        transform: scale(0.96);
      }

      /* The outline is kept so both ends of the row hold the same shape —
         removing it left bare text on one side against a pill on the other,
         which read as lopsided. The fade plus muted ink carries "unavailable". */
      .pg-arrow:disabled {
        background: transparent;
        color: var(--text-muted);
        opacity: 0.55;
        cursor: default;
      }

      .pg-arrow-icon {
        font-size: 20px;
      }

      /* ---- Page numbers ---- */
      .pg-list {
        display: none;
        align-items: center;
        gap: 2px;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .pg-page {
        display: grid;
        place-items: center;
        /* Square footprint keeps every number a circle regardless of digits. */
        width: var(--pg-size);
        padding: 0;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }

      .pg-page:hover:not(.is-current) {
        background: var(--hover);
        color: var(--text-primary);
      }

      .pg-page:active:not(.is-current) {
        transform: scale(0.94);
      }

      /* No halo ring here: against the dark surface it read as a heavy outline
         rather than a glow. The fill is already the only solid in the row, so it
         needs no further emphasis. */
      .pg-page.is-current {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--on-primary);
        cursor: default;
      }

      .pg-gap {
        display: grid;
        place-items: center;
        width: 24px;
        height: var(--pg-size);
        color: var(--text-muted);
        font-size: var(--text-sm);
        line-height: 1;
        user-select: none;
      }

      .pg-compact {
        padding: 0 var(--space-1);
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }

      /* Below this the labels are dropped and the arrows collapse to circles, so
         the row stays on one line next to the "Page X of Y" text. */
      @media (max-width: 424px) {
        .pg {
          --pg-size: 36px;
        }

        .pg-arrow {
          width: var(--pg-size);
          padding: 0;
          justify-content: center;
        }

        .pg-arrow-text {
          display: none;
        }
      }

      /* Numbered pages replace the compact label once there's room */
      @media (min-width: 768px) {
        .pg-list {
          display: flex;
        }

        .pg-compact {
          display: none;
        }
      }
    `,
  ],
})
export class PaginationComponent {
  /** Current 1-based page. */
  readonly currentPage = input(1);

  /** Total number of pages. The control renders nothing when this is <= 1. */
  readonly totalPages = input(1);

  /** How many pages to show either side of the current one. */
  readonly siblings = input(1);

  /** Accessible label for the nav landmark. */
  readonly label = input('Pagination');

  /** Emits the requested page number. */
  readonly pageChange = output<number>();

  /**
   * Windowed page list. `null` entries render as an ellipsis.
   * e.g. 1 … 4 5 6 … 20
   */
  protected readonly pages = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const siblings = this.siblings();

    // First page, last page, current, its siblings, and two ellipsis slots
    const maxSlots = siblings * 2 + 5;
    if (total <= maxSlots) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const left = Math.max(current - siblings, 1);
    const right = Math.min(current + siblings, total);

    const out: (number | null)[] = [1];
    if (left > 2) out.push(null);
    for (let p = Math.max(left, 2); p <= Math.min(right, total - 1); p++) out.push(p);
    if (right < total - 1) out.push(null);
    out.push(total);
    return out;
  });

  protected go(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.pageChange.emit(page);
  }
}
