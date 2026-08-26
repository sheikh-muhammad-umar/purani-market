import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '../../../core/constants/routes';

/**
 * Standalone search entry point that navigates to the search results page.
 *
 * Owns its own `Router` dependency so host pages don't have to take one, and
 * mirrors the header's behaviour by submitting to `/search?q=`.
 */
@Component({
  selector: 'app-search-bar',
  standalone: true,
  template: `
    <form class="sb" [class.sb-lg]="size() === 'lg'" (submit)="onSubmit($event)" role="search">
      <span class="material-symbols-rounded sb-icon">search</span>

      <label class="sb-label" [attr.for]="inputId">{{ label() }}</label>
      <input
        [id]="inputId"
        class="sb-input"
        type="search"
        name="q"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="query()"
        (input)="onInput($event)"
      />

      <button type="submit" class="btn btn-primary sb-btn">
        <span class="sb-btn-text">Search</span>
        <span class="material-symbols-rounded sb-btn-icon">arrow_forward</span>
      </button>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .sb {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        width: 100%;
        padding: 5px 5px 5px var(--space-1);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--surface);
        box-shadow: var(--shadow-card);
        transition:
          box-shadow var(--duration-base) var(--ease-out),
          border-color var(--duration-base) var(--ease-out);
      }

      .sb:focus-within {
        border-color: var(--primary);
        box-shadow: var(--shadow-hover);
      }

      .sb-icon {
        flex-shrink: 0;
        font-size: 20px;
        color: var(--text-muted);
      }

      /* Available to assistive tech; the placeholder carries the visual label */
      .sb-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .sb-input {
        flex: 1;
        min-width: 0;
        padding: 8px 0;
        border: none;
        background: transparent;
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
      }

      .sb-input::placeholder {
        color: var(--text-muted);
      }

      .sb-input:focus {
        outline: none;
      }

      /* Hide the native clear button so it doesn't collide with submit */
      .sb-input::-webkit-search-cancel-button {
        -webkit-appearance: none;
        appearance: none;
      }

      .sb-btn {
        flex-shrink: 0;
        padding: 0;
        width: 38px;
        height: 38px;
        justify-content: center;
        border-radius: var(--radius-full);
      }

      .sb-btn-text {
        display: none;
      }

      .sb-btn-icon {
        font-size: 20px;
      }

      /* ---- Large variant, used in the home hero ---- */
      .sb-lg {
        padding: 6px 6px 6px var(--space-2);
      }

      .sb-lg .sb-icon {
        font-size: 22px;
      }

      .sb-lg .sb-input {
        padding: 10px 0;
        font-size: var(--text-base);
      }

      @media (min-width: 768px) {
        .sb-lg .sb-btn {
          width: auto;
          height: auto;
          padding: 10px var(--space-3);
        }

        .sb-lg .sb-btn-text {
          display: block;
        }

        .sb-lg .sb-btn-icon {
          display: none;
        }
      }
    `,
  ],
})
export class SearchBarComponent {
  private readonly router = inject(Router);

  /** Unique id so the label/input pair stays valid with multiple instances. */
  protected readonly inputId = `sb-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly query = signal('');

  /** Visual size. `lg` is intended for hero sections. */
  readonly size = input<'md' | 'lg'>('md');

  /** Placeholder text. */
  readonly placeholder = input('What are you looking for?');

  /** Accessible label for the input. */
  readonly label = input('Search listings');

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    this.router.navigate([ROUTES.SEARCH], { queryParams: q ? { q } : {} });
  }
}
