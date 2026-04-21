import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ListingsService, ListingsResponse } from '../../../core/services/listings.service';
import { ReviewsService, ReviewsResponse } from '../../../core/services/reviews.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginModalService } from '../../../shared/components/login-modal/login-modal.service';
import { Listing, Review } from '../../../core/models';
import { VerificationBadgesComponent } from '../../../shared/components/verification-badges/verification-badges.component';
import { extractIdFromSlug } from '../../../core/utils/slug';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ListingUrlPipe, VerificationBadgesComponent],
  templateUrl: './listing-detail.component.html',
  styleUrls: ['./listing-detail.component.scss'],
})
export class ListingDetailComponent implements OnInit {
  listing = signal<Listing | null>(null);
  loading = signal(true);
  error = signal('');
  currentImageIndex = signal(0);

  // Reviews
  reviews = signal<Review[]>([]);
  averageRating = signal(0);
  totalReviews = signal(0);

  // Favorites
  isFavorited = signal(false);
  favoriteId = signal<string | null>(null);
  favoriteAnimating = signal(false);

  // Share
  shareToastVisible = signal(false);
  sharePopupOpen = signal(false);

  // Lightbox
  lightboxOpen = signal(false);

  // Similar listings
  similarListings = signal<Listing[]>([]);

  // Seller info (derived from listing)
  sellerTrustScore = computed(() => this.averageRating());
  sellerResponseTime = signal('Within 1 hour');
  sellerVerified = signal(true);
  sellerMemberSince = signal('2024');

  // Map
  mapUrl = signal<SafeResourceUrl | null>(null);

  // Touch swipe
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly swipeThreshold = 50;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly listingsService: ListingsService,
    private readonly reviewsService: ReviewsService,
    private readonly favoritesService: FavoritesService,
    public readonly authService: AuthService,
    private readonly sanitizer: DomSanitizer,
    public readonly loginModal: LoginModalService,
    public readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    if (!rawId) {
      this.error.set('Listing not found');
      this.loading.set(false);
      return;
    }
    const id = extractIdFromSlug(rawId);

    this.listingsService.getById(id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);
        this.buildMapUrl(listing);
        this.loadReviews(listing._id);
        this.loadSimilarListings(listing.categoryId);
        this.checkFavoriteStatus(listing._id);
        this.tracker.track('view', {
          productListingId: listing._id,
          categoryId: listing.categoryId,
          metadata: { title: listing.title, city: listing.location?.city },
        });
      },
      error: () => {
        this.error.set('Failed to load listing');
        this.loading.set(false);
      },
    });
  }

  private loadReviews(listingId: string): void {
    this.reviewsService.getByListing(listingId).subscribe({
      next: (res: ReviewsResponse) => {
        this.reviews.set(res.data);
        this.averageRating.set(res.averageRating);
        this.totalReviews.set(res.total);
      },
      error: () => {
        /* silently fail for reviews */
      },
    });
  }

  private loadSimilarListings(categoryId: string): void {
    this.listingsService.getByCategory(categoryId, 1, 8).subscribe({
      next: (res: ListingsResponse) => {
        const currentId = this.listing()?._id;
        this.similarListings.set(res.data.filter((l) => l._id !== currentId).slice(0, 6));
      },
      error: () => {
        /* silently fail */
      },
    });
  }

  private checkFavoriteStatus(listingId: string): void {
    if (!this.authService.isAuthenticated()) return;
    this.favoritesService.getAll().subscribe({
      next: (res) => {
        const favorites = Array.isArray(res) ? res : (res.data ?? []);
        const fav = favorites.find((f: any) => {
          const pid = f.productListingId;
          const id = typeof pid === 'string' ? pid : pid?._id;
          return id === listingId;
        });
        this.isFavorited.set(!!fav);
        this.favoriteId.set(fav?._id ?? null);
      },
      error: () => {
        /* not logged in or error */
      },
    });
  }

  toggleFavorite(): void {
    const listing = this.listing();
    if (!listing) return;

    if (!this.authService.isAuthenticated()) {
      this.loginModal.open(`/listings/${listing._id}`);
      return;
    }

    if (this.isFavorited()) {
      const fId = this.favoriteId();
      if (fId) {
        this.favoritesService.remove(fId).subscribe({
          next: () => {
            this.isFavorited.set(false);
            this.favoriteId.set(null);
            this.tracker.track('unfavorite', {
              productListingId: listing._id,
              metadata: { previousState: 'favorited', newState: 'unfavorited' },
            });
          },
          error: () => {
            // If remove fails, re-sync state
            this.checkFavoriteStatus(listing._id);
          },
        });
      } else {
        // No favoriteId cached, re-sync
        this.checkFavoriteStatus(listing._id);
      }
    } else {
      this.favoriteAnimating.set(true);
      this.favoritesService.add(listing._id).subscribe({
        next: (fav) => {
          this.isFavorited.set(true);
          this.favoriteId.set(fav._id);
          this.tracker.track('favorite', {
            productListingId: listing._id,
            metadata: { title: listing.title, previousState: 'unfavorited', newState: 'favorited' },
          });
          setTimeout(() => this.favoriteAnimating.set(false), 600);
        },
        error: (err) => {
          // 409 = already favorited, treat as success and sync state
          if (err?.status === 409) {
            this.isFavorited.set(true);
            this.checkFavoriteStatus(listing._id);
          }
          this.favoriteAnimating.set(false);
        },
      });
    }
  }

  nextImage(): void {
    const images = this.listing()?.images ?? [];
    if (this.currentImageIndex() < images.length - 1) {
      this.currentImageIndex.update((i) => i + 1);
    }
  }

  openLightbox(): void {
    this.lightboxOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
    document.body.style.overflow = '';
  }

  prevImage(): void {
    if (this.currentImageIndex() > 0) {
      this.currentImageIndex.update((i) => i - 1);
    }
  }

  getCurrentImage(): string {
    const images = this.listing()?.images ?? [];
    return images[this.currentImageIndex()]?.url ?? 'assets/placeholder.png';
  }

  // Details/Features helpers
  isArrayValue(value: unknown): boolean {
    return Array.isArray(value) || value === true || value === false;
  }

  formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getFeatureTags(attrs: Record<string, unknown> | undefined): string[] {
    if (!attrs) return [];
    const tags: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (Array.isArray(value)) {
        tags.push(...value.map((v) => String(v)));
      } else if (value === true) {
        tags.push(this.formatLabel(key));
      }
    }
    return tags;
  }

  getStarArray(rating: number): string[] {
    const stars: string[] = [];
    const rounded = Math.round(rating * 2) / 2;
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) {
        stars.push('full');
      } else if (i - 0.5 === rounded) {
        stars.push('half');
      } else {
        stars.push('empty');
      }
    }
    return stars;
  }

  getReviewStars(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  getMapUrl(): SafeResourceUrl | null {
    return this.mapUrl();
  }

  private buildMapUrl(listing: Listing): void {
    const loc = listing.location;
    if (!loc?.coordinates) return;
    const [lng, lat] = loc.coordinates;
    const url = `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
    this.mapUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  async shareListing(): Promise<void> {
    const l = this.listing();
    if (!l) return;

    this.tracker.track('share', { productListingId: l._id, metadata: { title: l.title } });

    // On mobile with native share API, use it directly
    if (navigator.share) {
      try {
        await navigator.share({
          title: l.title,
          text: `Check out: ${l.title}`,
          url: window.location.href,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      // Desktop: show share popup
      this.sharePopupOpen.set(true);
    }
  }

  closeSharePopup(): void {
    this.sharePopupOpen.set(false);
  }

  shareVia(platform: string): void {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(this.listing()?.title ?? '');
    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${title}%20${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${title}&body=Check%20this%20out:%20${url}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(window.location.href);
        this.sharePopupOpen.set(false);
        this.shareToastVisible.set(true);
        setTimeout(() => this.shareToastVisible.set(false), 2000);
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    }
    this.sharePopupOpen.set(false);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) < this.swipeThreshold) return;
    if (diff > 0) {
      this.nextImage();
    } else {
      this.prevImage();
    }
  }
}
