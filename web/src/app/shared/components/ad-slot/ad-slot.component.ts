import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { AdPlacement, ServedAd } from '../../../core/models/advertising.model';

/** Fraction of the slot that must be visible before an impression counts. */
const VIEWABILITY_THRESHOLD = 0.5;

/** How long the slot must stay visible before an impression counts, in ms. */
const VIEWABILITY_DWELL_MS = 1000;

/** Viewport width at or below which the mobile creative is preferred. */
const MOBILE_BREAKPOINT = 768;

/**
 * Renders whatever ad the server picks for a placement.
 *
 * Owns the whole lifecycle for one slot: fetching, presentation, viewability and
 * click reporting. Nothing is rendered until an ad actually arrives, so an unsold
 * placement leaves no gap in the layout — which is why callers can drop a slot
 * anywhere without guarding it themselves.
 *
 * An impression is only reported once the slot has been at least half visible for
 * a moment, rather than on load, so counts reflect ads a person could actually
 * see rather than markup that existed far below the fold.
 */
@Component({
  selector: 'app-ad-slot',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './ad-slot.component.html',
  styleUrls: ['./ad-slot.component.scss'],
})
export class AdSlotComponent implements OnInit, OnDestroy {
  /** Which slot to fill. */
  readonly placement = input.required<AdPlacement>();

  /** Narrows targeting to the category being browsed. */
  readonly categoryId = input('');
  readonly provinceId = input('');
  readonly cityId = input('');

  /**
   * Presentation shape. `native` renders a listing-shaped card for in-feed use;
   * the banner variants differ only in aspect ratio.
   */
  readonly variant = input<'leaderboard' | 'inline' | 'native'>('leaderboard');

  /**
   * A creative the host already has.
   *
   * Grids interleave several ads among their cards; letting the host fetch once
   * and hand each slot its creative avoids one request per inserted card. When
   * this is set the slot renders and tracks it, and never fetches.
   */
  readonly preloaded = input<ServedAd | null>(null);

  readonly ad = signal<ServedAd | null>(null);
  readonly loaded = signal(false);

  /** Picks the narrow crop on small viewports, falling back to the wide one. */
  readonly activeImage = computed(() => {
    const creative = this.ad();
    if (!creative) return '';
    if (!creative.mobileImageUrl) return creative.imageUrl;
    return this.isMobile() ? creative.mobileImageUrl : creative.imageUrl;
  });

  @ViewChild('slotRoot') private slotRoot?: ElementRef<HTMLElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly advertising = inject(AdvertisingService);
  private readonly tracker = inject(ActivityTrackerService);
  private readonly isMobile = signal(false);

  private observer?: IntersectionObserver;
  private dwellTimer?: ReturnType<typeof setTimeout>;
  private impressionReported = false;
  private resizeListener?: () => void;

  ngOnInit(): void {
    this.syncViewport();
    if (this.isBrowser) {
      this.resizeListener = () => this.syncViewport();
      window.addEventListener('resize', this.resizeListener);
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.dwellTimer) clearTimeout(this.dwellTimer);
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private load(): void {
    const supplied = this.preloaded();
    if (supplied) {
      this.ad.set(supplied);
      this.loaded.set(true);
      this.watchForViewability();
      return;
    }

    this.advertising
      .serve(this.placement(), {
        categoryId: this.categoryId() || undefined,
        provinceId: this.provinceId() || undefined,
        cityId: this.cityId() || undefined,
      })
      .subscribe((ads) => {
        this.ad.set(ads[0] ?? null);
        this.loaded.set(true);
        if (ads.length > 0) this.watchForViewability();
      });
  }

  /**
   * Starts counting an impression once the slot is genuinely on screen.
   *
   * Without IntersectionObserver support the impression is reported immediately,
   * which over-counts slightly but is better than never crediting the advertiser.
   */
  private watchForViewability(): void {
    if (!this.isBrowser) return;
    if (typeof IntersectionObserver === 'undefined') {
      this.reportImpression();
      return;
    }

    // Deferred so the template has rendered and the element exists.
    setTimeout(() => {
      const element = this.slotRoot?.nativeElement;
      if (!element) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              if (this.dwellTimer) continue;
              this.dwellTimer = setTimeout(() => this.reportImpression(), VIEWABILITY_DWELL_MS);
            } else if (this.dwellTimer) {
              // Scrolled away before the dwell elapsed: not a viewable impression.
              clearTimeout(this.dwellTimer);
              this.dwellTimer = undefined;
            }
          }
        },
        { threshold: VIEWABILITY_THRESHOLD },
      );
      this.observer.observe(element);
    });
  }

  private reportImpression(): void {
    if (this.impressionReported) return;
    const creative = this.ad();
    if (!creative) return;

    this.impressionReported = true;
    this.observer?.disconnect();
    this.advertising.recordEvent(creative.creativeId, 'impression', creative.placement).subscribe();
  }

  /**
   * Reports the click. Navigation is left to the anchor itself so the ad behaves
   * like a normal link — middle-click and open-in-new-tab keep working, and a
   * failed report never blocks the visit.
   *
   * Written to both streams on purpose. `ad_events` is the billing record, keyed
   * by creative and placement; the activity copy puts the click in the visitor's
   * behavioural timeline, so what they did next is one query away rather than a
   * cross-collection join.
   *
   * Impressions are not mirrored. They are the highest-volume event in the system
   * and describe delivery rather than an action a person took, so duplicating
   * them would swamp the activity collection and distort its action breakdown.
   * They remain joinable through the shared session id.
   */
  onAdClick(): void {
    const creative = this.ad();
    if (!creative) return;
    this.advertising.recordEvent(creative.creativeId, 'click', creative.placement).subscribe();
    this.tracker.track(TrackingEvent.AD_CLICK, {
      categoryId: this.categoryId() || undefined,
      metadata: {
        creativeId: creative.creativeId,
        campaignId: creative.campaignId,
        placement: creative.placement,
        advertiserName: creative.advertiserName,
        title: creative.title,
        variant: this.variant(),
      },
    });
  }

  private syncViewport(): void {
    if (!this.isBrowser) return;
    this.isMobile.set(window.innerWidth <= MOBILE_BREAKPOINT);
  }
}
