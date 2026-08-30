import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CategoriesService } from './categories.service';

/**
 * How many names the placeholder cycles through.
 *
 * The rotation is a CSS animation with fixed keyframes, so the number of slots
 * has to be known at author time. Five is long enough to feel varied and short
 * enough that a shopper sees the cycle repeat rather than wondering whether it
 * stopped.
 */
const ROTATION_SLOTS = 5;

/**
 * Supplies the category names for the header's rotating search placeholder.
 *
 * Lives in a service rather than the search component because the header renders
 * that component twice (desktop and mobile). Two component-owned copies would
 * fetch categories twice and drift out of step; one shared list keeps both
 * identical and only fetches once.
 *
 * The rotation itself is done in CSS. It used to be a `setInterval` here plus a
 * `setTimeout` per swap, which meant a never-ending macrotask inside Angular's
 * zone: `ApplicationRef.isStable()` never emitted, hydration never completed, and
 * the HTTP transfer cache was never released — so a decorative animation was
 * quietly serving stale data on every server-rendered route. A keyframe animation
 * costs the framework nothing and cannot stall anything.
 */
@Injectable({ providedIn: 'root' })
export class SearchPlaceholderService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly categoriesService = inject(CategoriesService);

  /**
   * The names to cycle, already padded to `ROTATION_SLOTS`.
   *
   * Empty until categories load, which is what keeps the placeholder from
   * flashing a half-built rotation on first paint.
   */
  readonly slots = signal<string[]>([]);

  private started = false;

  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.categoriesService.getAll().subscribe({
      next: (categories) => {
        const names = categories.filter((c) => c.level === 1 && c.isActive).map((c) => c.name);
        if (!names.length) return;
        this.slots.set(this.buildSlots(names));
      },
      error: () => {
        // Placeholder decoration only — a failure here must not surface.
      },
    });
  }

  /**
   * Fills every slot, starting from a random point in the list.
   *
   * There are more categories than slots, so a fixed window would always
   * advertise the same few. Starting at a random offset spreads that across
   * visits without needing any scheduling. Wrapping with a modulo also means a
   * short list repeats instead of leaving a slot blank, which would otherwise
   * read as the animation having stalled.
   */
  private buildSlots(names: string[]): string[] {
    const offset = Math.floor(Math.random() * names.length);
    return Array.from({ length: ROTATION_SLOTS }, (_, i) => names[(offset + i) % names.length]);
  }
}
