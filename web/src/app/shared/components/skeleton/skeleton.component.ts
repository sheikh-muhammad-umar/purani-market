import { Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'block' | 'circle' | 'image';

/**
 * Generic shimmer placeholder.
 *
 * Replaces the ad-hoc `.skeleton-*` rules that were re-declared per feature.
 * For listing grids prefer `<app-listing-card [loading]="true" />`, which
 * guarantees the placeholder matches the real card's geometry.
 *
 * Usage:
 *   <app-skeleton variant="text" [lines]="3" />
 *   <app-skeleton variant="circle" width="48px" />
 *   <app-skeleton variant="image" />
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @if (variant() === 'text') {
      <span class="sk-lines" [style.gap]="lineGap()">
        @for (line of lineList(); track $index) {
          <span
            class="sk sk-line"
            [style.width]="lineWidth($index)"
            [style.height]="resolvedHeight()"
          ></span>
        }
      </span>
    } @else {
      <span
        class="sk"
        [style.width]="width()"
        [style.height]="resolvedHeight()"
        [style.border-radius]="resolvedRadius()"
        [style.aspect-ratio]="variant() === 'image' ? aspectRatio() : null"
      ></span>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* The highlight is a translated pseudo-element rather than an animated
         background-position. background-position cannot be composited, so it
         repaints the element every frame; a transform runs on the GPU and stays
         smooth even with a full grid of placeholders on screen. */
      .sk {
        position: relative;
        display: block;
        overflow: hidden;
        background: var(--surface-secondary);
        /* Clips the sweep to rounded corners without a second wrapper. */
        isolation: isolate;
      }

      .sk::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          var(--hover) 45%,
          var(--hover-strong) 50%,
          var(--hover) 55%,
          transparent 100%
        );
        transform: translateX(-100%);
        animation: sk-sweep 1.5s var(--ease-in-out) infinite;
        will-change: transform;
      }

      .sk-lines {
        display: flex;
        flex-direction: column;
      }

      .sk-line {
        border-radius: var(--radius-xs);
      }

      /* Successive lines lag slightly so a block of them ripples rather than
         flashing in unison, which reads as one deliberate motion. */
      .sk-line:nth-child(2)::after {
        animation-delay: 90ms;
      }

      .sk-line:nth-child(3)::after {
        animation-delay: 180ms;
      }

      .sk-line:nth-child(4)::after {
        animation-delay: 270ms;
      }

      @keyframes sk-sweep {
        to {
          transform: translateX(100%);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sk::after {
          animation: none;
          opacity: 0.5;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  /** Shape of the placeholder. */
  readonly variant = input<SkeletonVariant>('block');

  /** Any CSS width. Ignored when variant is `text`. */
  readonly width = input('100%');

  /** Any CSS height. Defaults per variant when left empty. */
  readonly height = input('');

  /** Any CSS border-radius. Defaults per variant when left empty. */
  readonly radius = input('');

  /** Number of shimmer lines to render when variant is `text`. */
  readonly lines = input(1);

  /** Gap between text lines. */
  readonly lineGap = input('8px');

  /** Aspect ratio used when variant is `image`. */
  readonly aspectRatio = input('4 / 3');

  protected readonly lineList = computed(() =>
    Array.from({ length: Math.max(1, this.lines()) }, (_, i) => i),
  );

  protected resolvedHeight(): string {
    if (this.height()) return this.height();
    switch (this.variant()) {
      case 'text':
        return '0.85em';
      case 'circle':
        return this.width();
      case 'image':
        return 'auto';
      default:
        return '1rem';
    }
  }

  protected resolvedRadius(): string {
    if (this.radius()) return this.radius();
    switch (this.variant()) {
      case 'circle':
        return 'var(--radius-full)';
      case 'image':
        return 'var(--radius-md)';
      default:
        return 'var(--radius-xs)';
    }
  }

  /** Last line of a multi-line block is shortened so it reads as prose. */
  protected lineWidth(index: number): string {
    const total = Math.max(1, this.lines());
    if (total === 1) return '100%';
    return index === total - 1 ? '60%' : '100%';
  }
}
