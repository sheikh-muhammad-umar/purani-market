import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  signal,
  computed,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoaderMode, LoaderSize } from './app-loader.types';
import {
  BRAND_LETTERS,
  BRAND_TAGLINE,
  GRID_LINES,
  PARTICLES,
  SPLASH_STEPS,
  SPLASH_CATEGORIES,
  PROGRESS_INTERVAL_MS,
  STEP_INTERVAL_MS,
  CATEGORY_INTERVAL_MS,
  CONTENT_ENTRANCE_DELAY_MS,
  DISMISS_DURATION_MS,
  PROGRESS_SPEEDS,
} from './app-loader.constants';

/**
 * Versatile loader component with three modes:
 *
 * 1. **Splash mode** (default on first load): Full-screen immersive intro
 *    that auto-dismisses. Shows brand, features, categories.
 *
 * 2. **Inline mode**: Compact loader for API calls, search, data loading.
 *    Controlled externally via `[loading]` input.
 *
 * 3. **Overlay mode**: Full-screen blocking loader for save/submit operations.
 *    Controlled externally via `[loading]` input.
 *
 * Usage:
 *   Splash:  <app-loader />
 *   Inline:  <app-loader mode="inline" [loading]="isLoading" message="Searching..." />
 *   Overlay: <app-loader mode="overlay" [loading]="isSaving" message="Saving your listing..." />
 */
@Component({
  selector: 'app-loader',
  standalone: true,
  templateUrl: './app-loader.component.html',
  styleUrl: './app-loader.component.scss',
})
export class AppLoaderComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input() mode: LoaderMode = 'splash';
  @Input() loading = true;
  @Input() message = '';
  @Input() size: LoaderSize = 'md';

  // Splash-specific state
  readonly progress = signal(0);
  readonly currentStep = signal(0);
  readonly visible = signal(true);
  readonly fadeOut = signal(false);
  readonly contentEntered = signal(false);
  readonly highlightedCat = signal(-1);

  // Pre-computed set of "past" step indices — avoids method call in template
  readonly pastSteps = computed(() => {
    const current = this.currentStep();
    const set = new Set<number>();
    for (let i = 0; i < current; i++) set.add(i);
    return set;
  });

  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private catTimer: ReturnType<typeof setInterval> | null = null;
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  private entranceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Static data from constants — no recalculation
  readonly brandLetters = BRAND_LETTERS;
  readonly brandTagline = BRAND_TAGLINE;
  readonly gridLines = GRID_LINES;
  readonly steps = SPLASH_STEPS;
  readonly categories = SPLASH_CATEGORIES;
  readonly particles = PARTICLES;

  readonly progressText = computed(() => {
    const p = this.progress();
    if (p < 25) return 'Loading marketplace...';
    if (p < 50) return 'Preparing your experience...';
    if (p < 75) return 'Almost there...';
    return 'Welcome!';
  });

  ngOnInit(): void {
    if (!this.isBrowser || this.mode !== 'splash') return;

    this.entranceTimeout = setTimeout(
      () => this.contentEntered.set(true),
      CONTENT_ENTRANCE_DELAY_MS,
    );

    let prog = 0;
    this.progressTimer = setInterval(() => {
      const speed =
        prog < 30
          ? PROGRESS_SPEEDS.slow
          : prog < 70
            ? PROGRESS_SPEEDS.medium
            : PROGRESS_SPEEDS.fast;
      prog += speed;
      if (prog >= 100) {
        prog = 100;
        this.clearTimer('progressTimer');
        this.dismiss();
      }
      this.progress.set(prog);
    }, PROGRESS_INTERVAL_MS);

    this.stepTimer = setInterval(() => {
      this.currentStep.set((this.currentStep() + 1) % this.steps.length);
    }, STEP_INTERVAL_MS);

    this.catTimer = setInterval(() => {
      this.highlightedCat.set((this.highlightedCat() + 1) % this.categories.length);
    }, CATEGORY_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    this.clearTimer('progressTimer');
    this.clearTimer('stepTimer');
    this.clearTimer('catTimer');
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
    if (this.entranceTimeout) {
      clearTimeout(this.entranceTimeout);
      this.entranceTimeout = null;
    }
  }

  private dismiss(): void {
    this.fadeOut.set(true);
    this.dismissTimeout = setTimeout(() => this.visible.set(false), DISMISS_DURATION_MS);
    this.clearTimer('stepTimer');
    this.clearTimer('catTimer');
  }

  private clearTimer(name: 'progressTimer' | 'stepTimer' | 'catTimer'): void {
    if (this[name]) {
      clearInterval(this[name]!);
      this[name] = null;
    }
  }
}
