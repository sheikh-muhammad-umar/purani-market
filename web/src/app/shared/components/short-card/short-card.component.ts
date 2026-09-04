import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShortVideo } from '../../../core/services/shorts.service';
import { ROUTES } from '../../../core/constants/routes';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * Vertical short-video tile for the shorts rail.
 *
 * Uses the same stretched-link pattern as `ListingCardComponent` so the whole
 * tile is clickable from a single anchor.
 */
@Component({
  selector: 'app-short-card',
  standalone: true,
  imports: [RouterLink, SkeletonComponent],
  template: `
    @if (loading() || !short()) {
      <article class="sc sc-loading" aria-hidden="true">
        <div class="sc-media">
          <app-skeleton variant="block" width="100%" height="100%" radius="0" />
        </div>
        <div class="sc-body">
          <app-skeleton variant="block" width="85%" height="0.75rem" />
          <app-skeleton variant="block" width="50%" height="0.65rem" />
        </div>
      </article>
    } @else {
      @let item = short()!;

      <article class="sc">
        <div class="sc-media">
          @if (posterSrc()) {
            <!-- Prefer a real frame from the video itself -->
            <video
              class="sc-thumb"
              [src]="posterSrc()"
              preload="metadata"
              muted
              playsinline
            ></video>
          } @else if (item.video.thumbnailUrl) {
            <img
              class="sc-thumb"
              [src]="item.video.thumbnailUrl"
              [alt]="label()"
              loading="lazy"
              decoding="async"
            />
          }

          <span class="sc-play">
            <span class="material-symbols-rounded sc-play-icon">play_arrow</span>
          </span>

          @if (durationLabel()) {
            <span class="sc-duration">{{ durationLabel() }}</span>
          }

          @if (showFavorite()) {
            <button
              type="button"
              class="sc-fav"
              [class.is-active]="favorited()"
              [disabled]="favoritePending()"
              [attr.aria-label]="favorited() ? 'Remove from favourites' : 'Save to favourites'"
              [attr.aria-pressed]="favorited()"
              (click)="onFavorite($event)"
            >
              @if (favoritePending()) {
                <span class="sc-fav-spinner" aria-hidden="true"></span>
              } @else {
                <span class="material-symbols-rounded sc-fav-icon">favorite</span>
              }
            </button>
          }
        </div>

        <div class="sc-body">
          <h3 class="sc-title">
            <a class="sc-link" [routerLink]="ROUTES.SHORTS" [queryParams]="{ id: item._id }">
              {{ label() }}
            </a>
          </h3>

          @if (item.price) {
            <span class="sc-price">
              {{ item.currency || CURRENCY_SYMBOL }} {{ item.price.toLocaleString() }}
            </span>
          } @else {
            <span class="sc-views">
              <span class="material-symbols-rounded sc-views-icon">visibility</span>
              {{ item.viewCount }}
            </span>
          }
        </div>
      </article>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .sc {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        overflow: hidden;
        transition:
          box-shadow var(--duration-base) var(--ease-out),
          border-color var(--duration-base) var(--ease-out),
          transform var(--duration-base) var(--ease-out);
      }

      .sc:hover {
        border-color: var(--border-strong);
        box-shadow: var(--shadow-hover);
        transform: translateY(-3px);
      }

      .sc:has(.sc-link:focus-visible) {
        border-color: var(--primary);
        box-shadow: var(--shadow-focus);
      }

      .sc-media {
        position: relative;
        width: 100%;
        aspect-ratio: 9 / 16;
        overflow: hidden;
        /* Dark base so letterboxed portrait video blends in */
        background: #14141f;
      }

      .sc-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
        transition: transform var(--duration-slow) var(--ease-out);
      }

      .sc:hover .sc-thumb {
        transform: scale(1.05);
      }

      .sc-play {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      .sc-play-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-full);
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        color: #fff;
        font-size: 24px;
        font-variation-settings: 'FILL' 1;
        transition:
          background-color var(--duration-base) var(--ease-out),
          transform var(--duration-base) var(--ease-out);
      }

      .sc:hover .sc-play-icon {
        background: var(--primary);
        color: var(--on-primary);
        transform: scale(1.1);
      }

      /* Mirrors the favourite control on ListingCardComponent */
      .sc-fav {
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: var(--radius-full);
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #fff;
        transition:
          background-color var(--duration-base) var(--ease-out),
          transform var(--duration-fast) var(--ease-out);
      }

      .sc-fav:hover {
        background: rgba(0, 0, 0, 0.62);
        transform: scale(1.08);
      }

      .sc-fav:disabled {
        cursor: default;
      }

      .sc-fav.is-active {
        background: var(--secondary);
      }

      .sc-fav-icon {
        font-size: 17px;
        font-variation-settings: 'FILL' 0;
      }

      .sc-fav.is-active .sc-fav-icon {
        font-variation-settings: 'FILL' 1;
      }

      .sc-fav-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: var(--radius-full);
        animation: sc-spin 0.6s linear infinite;
      }

      @keyframes sc-spin {
        to {
          transform: rotate(360deg);
        }
      }

      .sc-duration {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 2px 6px;
        border-radius: var(--radius-xs);
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: #fff;
        font-size: 10px;
        font-weight: var(--weight-semibold);
        font-variant-numeric: tabular-nums;
      }

      .sc-body {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
        padding: var(--space-1);
      }

      .sc-title {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        line-height: var(--leading-snug);
        letter-spacing: var(--tracking-normal);
        color: var(--text-primary);
        min-height: calc(2 * var(--text-xs) * var(--leading-snug));
      }

      .sc-link {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: inherit;
        text-decoration: none;
      }

      .sc-link::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
      }

      .sc-link:focus-visible {
        outline: none;
      }

      .sc-price {
        margin-top: auto;
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        color: var(--primary);
        font-variant-numeric: tabular-nums;
      }

      .sc-views {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-top: auto;
        font-size: 11px;
        color: var(--text-muted);
      }

      .sc-views-icon {
        font-size: 13px;
      }

      .sc-loading:hover {
        transform: none;
        box-shadow: none;
        border-color: var(--border);
      }
    `,
  ],
})
export class ShortCardComponent {
  protected readonly ROUTES = ROUTES;
  protected readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;

  /** The short to render. */
  readonly short = input<ShortVideo | null>(null);

  /** Render a shimmer placeholder. */
  readonly loading = input(false);

  /** Show the favourite toggle over the thumbnail. */
  readonly showFavorite = input(false);

  /** Current saved state of the favourite toggle. */
  readonly favorited = input(false);

  /** Show a spinner in place of the heart while a toggle is in flight. */
  readonly favoritePending = input(false);

  /** Emitted when the favourite toggle is activated. */
  readonly favoriteToggled = output<ShortVideo>();

  protected onFavorite(event: Event): void {
    // The tile is a stretched link, so the click must not reach it.
    event.preventDefault();
    event.stopPropagation();
    const item = this.short();
    if (item) {
      this.favoriteToggled.emit(item);
    }
  }

  protected readonly label = computed(
    () => this.short()?.title || this.short()?.description || 'Short video',
  );

  protected readonly posterSrc = computed(() => {
    const video = this.short()?.video;
    const src = video?.compressedUrl || video?.url;
    if (!src) return '';
    return src.includes('#') ? src : `${src}#t=0.1`;
  });

  protected readonly durationLabel = computed(() => {
    const seconds = this.short()?.video?.duration;
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  });
}
