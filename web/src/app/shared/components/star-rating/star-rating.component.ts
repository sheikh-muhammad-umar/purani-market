import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Read-only star rating display.
 *
 * Renders five stars with the fractional part of `rating` shown as a partially
 * filled star, plus an optional numeric value and review count. Purely
 * presentational — for capturing a rating, use the interactive selector in the
 * write-review form.
 *
 *   <app-star-rating [rating]="4.5" [count]="12" />
 */
@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="star-rating"
      [class.sm]="size() === 'sm'"
      [class.lg]="size() === 'lg'"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="stars" aria-hidden="true">
        @for (fill of fills(); track $index) {
          <span class="star">
            <span class="star-bg">★</span>
            <span class="star-fill" [style.width.%]="fill">★</span>
          </span>
        }
      </span>
      @if (showValue() && count() > 0) {
        <span class="rating-value">{{ rating().toFixed(1) }}</span>
      }
      @if (showCount() && count() > 0) {
        <span class="rating-count">({{ count() }})</span>
      }
      @if (count() === 0 && showEmptyLabel()) {
        <span class="rating-count">No reviews</span>
      }
    </span>
  `,
  styleUrl: './star-rating.component.scss',
})
export class StarRatingComponent {
  readonly rating = input(0);
  readonly count = input(0);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showValue = input(true);
  readonly showCount = input(true);
  /** When true and there are no reviews, render a "No reviews" hint. */
  readonly showEmptyLabel = input(false);

  /** Per-star fill percentage (0–100) for the current rating. */
  readonly fills = computed<number[]>(() => {
    const r = Math.max(0, Math.min(5, this.rating()));
    return Array.from({ length: 5 }, (_, i) => {
      const diff = r - i;
      if (diff >= 1) return 100;
      if (diff <= 0) return 0;
      return Math.round(diff * 100);
    });
  });

  readonly ariaLabel = computed(() =>
    this.count() > 0
      ? `Rated ${this.rating().toFixed(1)} out of 5 from ${this.count()} review(s)`
      : 'No reviews yet',
  );
}
