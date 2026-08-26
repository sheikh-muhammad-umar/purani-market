import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CategoriesService } from './categories.service';

/** Interval (ms) between placeholder category swaps. */
const ROTATE_INTERVAL = 3000;

/** Duration (ms) of the slide-out half of the swap. Must match the CSS. */
const SLIDE_DURATION = 300;

/**
 * Drives the rotating category name in the header's search placeholder.
 *
 * Lives in a service rather than the search component because the header
 * renders that component twice (desktop and mobile). Two component-owned
 * timers would fetch categories twice and drift out of step with each other;
 * one shared timer keeps both in sync and only starts once.
 */
@Injectable({ providedIn: 'root' })
export class SearchPlaceholderService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly categoriesService = inject(CategoriesService);

  /** Category name currently shown. Empty until categories load. */
  readonly category = signal('');

  /** True while the current word is sliding out. */
  readonly animating = signal(false);

  private names: string[] = [];
  private index = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.categoriesService.getAll().subscribe({
      next: (categories) => {
        this.names = categories.filter((c) => c.level === 1 && c.isActive).map((c) => c.name);
        if (!this.names.length) return;
        this.category.set(this.names[0]);
        this.timer = setInterval(() => this.advance(), ROTATE_INTERVAL);
      },
      error: () => {
        // Placeholder decoration only — a failure here must not surface.
      },
    });
  }

  private advance(): void {
    this.animating.set(true);
    this.swapTimer = setTimeout(() => {
      this.index = (this.index + 1) % this.names.length;
      this.category.set(this.names[this.index]);
      this.animating.set(false);
    }, SLIDE_DURATION);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.timer = null;
    this.swapTimer = null;
  }
}
