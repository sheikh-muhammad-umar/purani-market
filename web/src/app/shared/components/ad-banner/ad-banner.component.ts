import { Component, input, inject, PLATFORM_ID, signal, OnInit, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

const MOBILE_BREAKPOINT = 768;

@Component({
  selector: 'app-ad-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ad-banner.component.html',
  styleUrls: ['./ad-banner.component.scss'],
})
export class AdBannerComponent implements OnInit, OnDestroy {
  /** Image source URL (used for desktop, or both if mobileSrc not provided) */
  readonly src = input.required<string>();

  /** Mobile image source URL (falls back to src if not provided) */
  readonly mobileSrc = input('');

  /** Alt text for accessibility */
  readonly alt = input('Advertisement');

  /** Internal route link (use this OR href, not both) */
  readonly link = input('');

  /** External URL (opens in new tab) */
  readonly href = input('');

  /** Aspect ratio variant based on IAB/Google standard ad sizes */
  readonly variant = input<'leaderboard' | 'inline'>('leaderboard');

  /** Resolved image source based on viewport */
  readonly activeSrc = signal('');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private resizeListener: (() => void) | null = null;

  ngOnInit(): void {
    this.updateActiveSrc();
    if (this.isBrowser && this.mobileSrc()) {
      this.resizeListener = () => this.updateActiveSrc();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private updateActiveSrc(): void {
    const mobile = this.mobileSrc();
    if (!mobile || !this.isBrowser) {
      this.activeSrc.set(this.src());
      return;
    }
    this.activeSrc.set(window.innerWidth < MOBILE_BREAKPOINT ? mobile : this.src());
  }
}
