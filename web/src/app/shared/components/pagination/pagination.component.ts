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
          class="btn btn-ghost btn-sm pg-arrow"
          [disabled]="currentPage() <= 1"
          (click)="go(currentPage() - 1)"
          aria-label="Previous page"
        >
          <span class="material-symbols-rounded pg-arrow-icon">chevron_left</span>
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

        <p class="pg-compact" aria-hidden="true">Page {{ currentPage() }} of {{ totalPages() }}</p>

        <button
          type="button"
          class="btn btn-ghost btn-sm pg-arrow"
          [disabled]="currentPage() >= totalPages()"
          (click)="go(currentPage() + 1)"
          aria-label="Next page"
        >
          <span class="pg-arrow-text">Next</span>
          <span class="material-symbols-rounded pg-arrow-icon">chevron_right</span>
        </button>
      </nav>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .pg {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-1);
        flex-wrap: wrap;
        padding: var(--space-3) 0;
      }

      .pg-arrow {
        flex-shrink: 0;
      }

      .pg-arrow-icon {
        font-size: 18px;
      }

      .pg-list {
        display: none;
        align-items: center;
        gap: 4px;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .pg-page {
        display: grid;
        place-items: center;
        min-width: 36px;
        height: 36px;
        padding: 0 8px;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-secondary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition:
          background-color var(--duration-base) var(--ease-out),
          color var(--duration-base) var(--ease-out),
          border-color var(--duration-base) var(--ease-out);
      }

      .pg-page:hover {
        background: var(--hover);
        color: var(--text-primary);
      }

      .pg-page.is-current {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--on-primary);
      }

      .pg-gap {
        min-width: 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: var(--text-sm);
        user-select: none;
      }

      .pg-compact {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
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
