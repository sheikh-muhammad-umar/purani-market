import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Standard "nothing to show" panel.
 *
 * Consolidates the 23 separate `.empty-state` blocks that previously existed
 * across features. Provide either `actionLink` (renders a router link) or
 * `actionText` alone (renders a button and emits `actionClicked`).
 *
 * Usage:
 *   <app-empty-state
 *     icon="favorite"
 *     title="No saved ads yet"
 *     message="Tap the heart on any listing to save it here."
 *     actionText="Browse listings"
 *     [actionLink]="ROUTES.SEARCH" />
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="es" [class.es-compact]="compact()">
      @if (icon()) {
        <span class="es-icon-wrap">
          <span class="material-symbols-rounded es-icon">{{ icon() }}</span>
        </span>
      }

      <p class="es-title">{{ title() }}</p>

      @if (message()) {
        <p class="es-message">{{ message() }}</p>
      }

      <!-- Extra content (suggestion chips, related links) sits between the
           message and the call to action. -->
      <div class="es-slot">
        <ng-content />
      </div>

      @if (actionText()) {
        @if (actionLink()) {
          <a
            class="btn btn-primary btn-pill es-action"
            [routerLink]="actionLink()"
            [queryParams]="actionQueryParams()"
          >
            {{ actionText() }}
          </a>
        } @else {
          <button
            type="button"
            class="btn btn-primary btn-pill es-action"
            (click)="actionClicked.emit()"
          >
            {{ actionText() }}
          </button>
        }
      }
    </div>
  `,
  styles: [
    `
      .es {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: var(--space-6) var(--space-2);
        gap: var(--space-1);
      }

      .es-compact {
        padding: var(--space-3) var(--space-2);
      }

      .es-icon-wrap {
        display: grid;
        place-items: center;
        width: 64px;
        height: 64px;
        margin-bottom: var(--space-1);
        border-radius: var(--radius-full);
        background: var(--surface-secondary);
        color: var(--text-muted);
      }

      .es-compact .es-icon-wrap {
        width: 48px;
        height: 48px;
      }

      .es-icon {
        font-size: 30px;
      }

      .es-compact .es-icon {
        font-size: 24px;
      }

      .es-title {
        font-size: var(--text-base);
        font-weight: var(--weight-semibold);
        color: var(--text-primary);
        letter-spacing: var(--tracking-tight);
      }

      .es-message {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: var(--leading-normal);
        max-width: 42ch;
      }

      /* display:contents means the wrapper adds no box of its own, so an empty
         slot contributes no spacing and projected children take part in the
         parent's flex column directly. */
      .es-slot {
        display: contents;
      }

      .es-action {
        margin-top: var(--space-2);
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Material Symbols icon name. Pass an empty string to hide the icon. */
  readonly icon = input('inbox');

  /** Short headline. */
  readonly title = input('Nothing here yet');

  /** Optional supporting sentence. */
  readonly message = input('');

  /** Label for the optional call to action. */
  readonly actionText = input('');

  /** Route for the call to action. When empty, a button is rendered instead. */
  readonly actionLink = input('');

  /** Query params applied to the call-to-action route. */
  readonly actionQueryParams = input<Record<string, unknown>>({});

  /** Tighter padding, for use inside cards and panels. */
  readonly compact = input(false);

  /** Emitted when the action is a button rather than a link. */
  readonly actionClicked = output<void>();
}
