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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ShortsService, ShortVideo } from '../../../core/services/shorts.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { sellerSlug } from '../../../core/utils/slug';
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
  readonly sellerInitial = computed(() =>
    (this.short?.sellerId?.profile?.firstName?.[0] || 'S').toUpperCase(),
  );
  readonly isOwner = computed(() => {
    const user = this.authService.user();
    return !!user && user._id === this.short?.sellerId?._id;
  });

  private animationFrame: number | null = null;
  private viewInitialized = false;

  constructor(
    private readonly shortsService: ShortsService,
    private readonly router: Router,
    private readonly tracker: ActivityTrackerService,
    private readonly authService: AuthService,
  ) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.likeCount.set(this.short.favoriteCount);
    this.isLiked.set(!!this.short.isLikedByMe);
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

  toggleLike(): void {
    if (this.isLiked()) {
      this.shortsService.unlikeShort(this.short._id).subscribe({
        next: (res) => {
          this.isLiked.set(false);
          this.likeCount.set(res.favoriteCount);
          this.tracker.track(TrackingEvent.SHORT_UNLIKE, { metadata: { shortId: this.short._id } });
        },
      });
    } else {
      this.shortsService.likeShort(this.short._id).subscribe({
        next: (res) => {
          this.isLiked.set(true);
          this.likeCount.set(res.favoriteCount);
          this.tracker.track(TrackingEvent.SHORT_LIKE, {
            metadata: { shortId: this.short._id, sellerId: this.short.sellerId._id },
          });
        },
      });
    }
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
}
