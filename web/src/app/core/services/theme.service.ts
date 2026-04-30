import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.getStoredTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  toggle(): void {
    const next = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(next);
    this.applyTheme(next);
    if (this.isBrowser) {
      localStorage.setItem('theme', next);
    }
  }

  private applyTheme(theme: Theme): void {
    this.doc.documentElement.setAttribute('data-theme', theme);
  }

  private getStoredTheme(): Theme {
    if (!this.isBrowser) return 'light';
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
