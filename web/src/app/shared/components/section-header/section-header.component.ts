import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Section title row with an optional leading icon, note and trailing link.
 *
 * Usage:
 *   <app-section-header
 *     title="Featured Ads"
 *     icon="auto_awesome"
 *     iconColor="var(--accent)"
 *     linkText="See all"
 *     [link]="ROUTES.SEARCH"
 *     [linkQueryParams]="{ featured: true }" />
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sh">
      <div class="sh-left">
        <h2 class="sh-title">
          <!-- aria-hidden: the icon is ornamental, and an icon-font ligature is
               a real text node, so without this the heading's accessible name
               would read "auto_awesome Featured". -->
          @if (icon()) {
            <span class="sh-icon-wrap" [style.color]="iconColor() || null" aria-hidden="true">
              <span class="material-symbols-rounded sh-icon">{{ icon() }}</span>
            </span>
          }
          <span class="sh-text">{{ title() }}</span>
          @if (note()) {
            <span class="sh-note">{{ note() }}</span>
          }
        </h2>
        @if (subtitle()) {
          <p class="sh-subtitle">{{ subtitle() }}</p>
        }
      </div>

      @if (linkText() && link()) {
        <a class="sh-link" [routerLink]="link()" [queryParams]="linkQueryParams()">
          {{ linkText() }}
          <span class="material-symbols-rounded sh-link-icon">arrow_forward</span>
        </a>
      }
    </div>
  `,
  styles: [
    `
      .sh {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
      }

      .sh-left {
        min-width: 0;
      }

      .sh-title {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xl);
        font-weight: var(--weight-bold);
        letter-spacing: var(--tracking-tight);
        color: var(--text-primary);
      }

      /* Tinted chip derived from the icon's own colour. A bare amber glyph on
         the page reads as washed out (1.7:1); the chip gives it a defined edge
         so it looks deliberate without darkening the brand hue. */
      .sh-icon-wrap {
        display: inline-grid;
        place-items: center;
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, currentColor 16%, transparent);
        color: var(--primary);
      }

      .sh-icon {
        font-size: 18px;
      }

      .sh-text {
        min-width: 0;
      }

      /* Secondary qualifier, e.g. the active city next to "Near You" */
      .sh-note {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--text-muted);
        letter-spacing: var(--tracking-normal);
      }

      .sh-subtitle {
        margin-top: 2px;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .sh-link {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        padding: 6px 10px;
        border-radius: var(--radius-full);
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--primary);
        transition:
          background-color var(--duration-base) var(--ease-out),
          gap var(--duration-base) var(--ease-out);
      }

      .sh-link:hover {
        background: var(--primary-subtle);
        gap: 6px;
      }

      .sh-link-icon {
        font-size: 18px;
      }

      @media (max-width: 767px) {
        .sh-title {
          font-size: var(--text-lg);
        }

        .sh-icon-wrap {
          width: 26px;
          height: 26px;
        }

        .sh-icon {
          font-size: 16px;
        }
      }
    `,
  ],
})
export class SectionHeaderComponent {
  /** Section title. */
  readonly title = input.required<string>();

  /** Optional Material Symbols icon name. */
  readonly icon = input('');

  /** Optional CSS color for the icon, e.g. `var(--accent)`. */
  readonly iconColor = input('');

  /** Inline qualifier shown next to the title, e.g. a city name. */
  readonly note = input('');

  /** Optional supporting line under the title. */
  readonly subtitle = input('');

  /** Trailing link label. Requires `link` to render. */
  readonly linkText = input('');

  /** Trailing link route. */
  readonly link = input('');

  /** Query params for the trailing link. */
  readonly linkQueryParams = input<Record<string, unknown>>({});
}
