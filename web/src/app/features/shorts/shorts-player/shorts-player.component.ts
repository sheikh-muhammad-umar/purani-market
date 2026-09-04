import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  OnChanges,
  AfterViewInit,
  SimpleChanges,
  OnDestroy,
  signal,
  computed,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ShortsService, ShortVideo } from '../../../core/services/shorts.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { sellerSlug } from '../../../core/utils/slug';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-shorts-player',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shorts-player.component.html',
  styleUrl: './shorts-player.component.scss',
})
export class ShortsPlayerComponent implements OnChanges, AfterViewInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly sellerSlug = sellerSlug;
  @Input() short!: ShortVideo;
  @Input() isActive = false;
  @Input() muted = true;

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;

  readonly isPlaying = signal(false);
  readonly progress = signal(0);
  readonly descExpanded = signal(false);
  readonly isLiked = signal(false);
  readonly likeCount = signal(0);
  /** Guards against double-firing like/unlike from rapid taps. */
  readonly likePending = signal(false);
  readonly sellerInitial = computed(() =>
    (this.short?.sellerId?.profile?.firstName?.[0] || 'S').toUpperCase(),
  );
  readonly isOwner = computed(() => {
    const user = this.authService.user();
    return !!user && user._id === this.short?.sellerId?._id;
  });

  private animationFrame: number | null = null;
  private viewInitialized = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Ensures a full watch-through is reported at most once per instance. */
  private watchCompleteTracked = false;

  constructor(
    private readonly shortsService: ShortsService,
    private readonly router: Router,
    private readonly tracker: ActivityTrackerService,
    private readonly authService: AuthService,
    private readonly toast: ToastService,
  ) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.likeCount.set(this.short.favoriteCount);
    this.isLiked.set(!!this.short.isLikedByMe);
    // Video playback is a browser-only concern. During SSR the referenced
    // element has no media API (play/pause are undefined), so bail out.
    if (!this.isBrowser) return;
    if (this.isActive) {
      this.autoPlayWhenReady();
    }
  }

  private autoPlayWhenReady(): void {
    const video = this.videoRef?.nativeElement;
    if (!video) {
      setTimeout(() => this.autoPlayWhenReady(), 50);
      return;
    }
    if (video.readyState >= 2) {
      this.play();
    } else {
      video.addEventListener('canplay', () => this.play(), { once: true });
      // Fallback in case canplay never fires (e.g. network issue)
      setTimeout(() => this.play(), 500);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isActive'] && this.viewInitialized) {
      if (this.isActive) {
        this.play();
      } else {
        this.pause();
      }
    }
    if (changes['muted'] && this.viewInitialized) {
      const video = this.videoRef?.nativeElement;
      if (video) video.muted = this.muted;
    }
  }

  ngOnDestroy(): void {
    this.pause();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  private play(): void {
    if (!this.isBrowser) return;
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    video.muted = this.muted;
    video
      .play()
      .then(() => {
        this.isPlaying.set(true);
        this.trackProgress();
      })
      .catch(() => {
        this.isPlaying.set(false);
      });
  }

  private pause(): void {
    if (!this.isBrowser) return;
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.pause();
      this.isPlaying.set(false);
    }
  }

  private trackProgress(): void {
    const video = this.videoRef?.nativeElement;
    if (!video) return;

    const update = () => {
      if (video.duration) {
        this.progress.set((video.currentTime / video.duration) * 100);
      }
      if (this.isPlaying()) {
        this.animationFrame = requestAnimationFrame(update);
      }
    };
    this.animationFrame = requestAnimationFrame(update);
  }

  toggleDescription(): void {
    this.descExpanded.update((v) => !v);
  }

  onVideoLoaded(): void {
    // When video data loads, the first frame is shown as the thumbnail
    // If not active, pause at first frame so it shows as a poster
    const video = this.videoRef?.nativeElement;
    if (video && !this.isActive) {
      video.currentTime = 0;
    }
  }

  /**
   * Fires when the video reaches the end. The player loops, so this marks a
   * full watch-through. Reported once per player instance to avoid inflating
   * the metric while the loop keeps replaying.
   */
  onVideoEnded(): void {
    if (this.watchCompleteTracked) return;
    this.watchCompleteTracked = true;
    const video = this.videoRef?.nativeElement;
    this.tracker.track(TrackingEvent.SHORT_VIEW, {
      shortVideoId: this.short._id,
      metadata: {
        sellerId: this.short.sellerId._id,
        completed: true,
        watchSeconds: video?.duration ? Math.round(video.duration) : undefined,
      },
    });
  }

  toggleLike(): void {
    // In-flight lock: ignore taps until the current request settles, so rapid
    // taps cannot fire overlapping like/unlike calls.
    if (this.likePending()) return;

    const wasLiked = this.isLiked();
    const prevCount = this.likeCount();

    // Optimistic update — flip immediately, reconcile with the server response.
    this.isLiked.set(!wasLiked);
    this.likeCount.set(prevCount + (wasLiked ? -1 : 1));
    this.likePending.set(true);

    const request$ = wasLiked
      ? this.shortsService.unlikeShort(this.short._id)
      : this.shortsService.likeShort(this.short._id);

    request$.subscribe({
      next: (res) => {
        this.isLiked.set(res.liked);
        this.likeCount.set(res.favoriteCount);
        this.likePending.set(false);
        this.tracker.track(wasLiked ? TrackingEvent.SHORT_UNLIKE : TrackingEvent.SHORT_LIKE, {
          shortVideoId: this.short._id,
          metadata: { sellerId: this.short.sellerId._id },
        });
      },
      error: () => {
        // Roll back the optimistic change and let the user know.
        this.isLiked.set(wasLiked);
        this.likeCount.set(prevCount);
        this.likePending.set(false);
        this.toast.error('Could not update your like. Please try again.');
      },
    });
  }

  startChat(): void {
    const linked = this.short.linkedListingId;
    const listingId = typeof linked === 'object' ? linked?._id : linked;
    this.tracker.track(TrackingEvent.SHORT_CHAT_CLICK, {
      metadata: {
        shortId: this.short._id,
        sellerId: this.short.sellerId._id,
        hasListing: !!listingId,
      },
    });
    if (listingId) {
      this.router.navigate([ROUTES.MESSAGING], {
        queryParams: { listingId },
      });
    } else {
      // Start conversation about this short
      this.router.navigate([ROUTES.MESSAGING], {
        queryParams: { shortId: this.short._id },
      });
    }
  }

  getWhatsAppLink(phone: string, title: string): string {
    const cleaned = phone.replace(/[^0-9+]/g, '').replace(/^0/, '92');
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const message = encodeURIComponent(
      `Hi, I'm interested in your short: "${title}" on Marketplace.\n${url}`,
    );
    return `https://wa.me/${cleaned}?text=${message}`;
  }

  onSellerClick(): void {
    this.tracker.track(TrackingEvent.SHORT_SELLER_CLICK, {
      metadata: { shortId: this.short._id, sellerId: this.short.sellerId._id },
    });
  }

  onCallClick(): void {
    this.tracker.track(TrackingEvent.SHORT_CALL_CLICK, {
      metadata: { shortId: this.short._id, sellerId: this.short.sellerId._id },
    });
  }

  shareShort(): void {
    this.tracker.track(TrackingEvent.SHORT_SHARE, {
      shortVideoId: this.short._id,
      metadata: { sellerId: this.short.sellerId._id },
    });

    // Record the share server-side so it counts toward shareCount/analytics.
    // Best-effort — a failure here must not block the share UX.
    this.shortsService.shareShort(this.short._id).subscribe({ error: () => {} });

    const url = `${window.location.origin}/shorts?id=${this.short._id}`;
    const title = this.short.title || this.short.description || 'Check out this short';

    if (navigator.share) {
      navigator.share({ title, url }).then(
        () => {},
        (err: any) => {
          // AbortError = the user dismissed the share sheet; not worth a toast.
          if (err?.name === 'AbortError') return;
          this.copyLinkFallback(url);
        },
      );
    } else {
      this.copyLinkFallback(url);
    }
  }

  private copyLinkFallback(url: string): void {
    navigator.clipboard.writeText(url).then(
      () => this.toast.success('Link copied to clipboard'),
      () => this.toast.error('Could not share this short.'),
    );
  }
}
