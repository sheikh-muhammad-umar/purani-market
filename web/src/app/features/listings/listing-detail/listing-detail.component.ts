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
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { PLACEHOLDER_IMAGE } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { ListingStatus } from '../../../core/constants/enums';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { buildMapEmbedUrl } from '../../../core/utils/map-link';
import { extractPackageDetails } from '../../../core/utils/package-details';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ListingUrlPipe, VerificationBadgesComponent],
  templateUrl: './listing-detail.component.html',
  styleUrls: ['./listing-detail.component.scss'],
})
export class ListingDetailComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly ListingStatus = ListingStatus;
  readonly TrackingEvent = TrackingEvent;
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

  // Touch swipe
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly swipeThreshold = 50;

  // Owner actions
  actionLoading = signal(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly listingsService: ListingsService,
    private readonly reviewsService: ReviewsService,
    private readonly favoritesService: FavoritesService,
    private readonly sanitizer: DomSanitizer,
    public readonly authService: AuthService,
    public readonly loginModal: LoginModalService,
    public readonly tracker: ActivityTrackerService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  mapEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const l = this.listing();
    if (!l?.location?.mapLink) return null;
    const fallback = l.location.area ? `${l.location.area}, ${l.location.city}` : l.location.city;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      buildMapEmbedUrl(l.location.mapLink, fallback),
    );
  });

  isOwner = computed(() => {
    const user = this.authService.user();
    const listing = this.listing();
    return !!user && !!listing && user._id === listing.sellerId;
  });

  currentImage = computed(() => {
    const images = this.listing()?.images ?? [];
    return images[this.currentImageIndex()]?.url ?? PLACEHOLDER_IMAGE;
  });

  formattedRating = computed(() => {
    return this.averageRating().toFixed(1);
  });

  packageInfo = computed<{ name: string; type: string } | null>(() => {
    const listing = this.listing();
    if (!listing?.purchaseId || typeof listing.purchaseId === 'string') return null;
    const pkg = listing.purchaseId.packageId;
    if (!pkg) return null;
    return { name: pkg.name, type: pkg.type };
  });

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    if (!rawId) {
      this.error.set(ERROR_MSG.LISTING_NOT_FOUND);
      this.loading.set(false);
      return;
    }
    const id = extractIdFromSlug(rawId);

    this.listingsService.getById(id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);
        this.loadReviews(listing._id);
        this.loadSimilarListings(listing.categoryId);
        this.checkFavoriteStatus(listing._id);
        this.tracker.track(TrackingEvent.VIEW, {
          productListingId: listing._id,
          categoryId: listing.categoryId,
          metadata: { title: listing.title, city: listing.location?.city },
        });
      },
      error: () => {
        this.error.set(ERROR_MSG.LISTING_LOAD_FAILED);
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
            this.tracker.track(TrackingEvent.UNFAVORITE, {
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
          this.tracker.track(TrackingEvent.FAVORITE, {
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
    return this.currentImage();
  }

  // Details/Features helpers
  isArrayValue(value: unknown): boolean {
    return Array.isArray(value) || value === true || value === false;
  }

  formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async shareListing(): Promise<void> {
    const l = this.listing();
    if (!l) return;

    this.tracker.track(TrackingEvent.SHARE, {
      productListingId: l._id,
      metadata: { title: l.title },
    });

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

  async deactivateListing(): Promise<void> {
    const listing = this.listing();
    if (!listing) return;

    if (listing.purchaseId) {
      const proceed = await this.showPackageWarningAndTrack(listing, 'deactivate');
      if (!proceed) return;
    }

    this.actionLoading.set(true);
    this.listingsService.updateStatus(listing._id, ListingStatus.INACTIVE).subscribe({
      next: (updated) => {
        this.actionLoading.set(false);
        this.listing.set(updated);
        this.tracker.track(TrackingEvent.LISTING_STATUS_CHANGE, {
          productListingId: listing._id,
          metadata: {
            previousStatus: listing.status,
            newStatus: ListingStatus.INACTIVE,
            title: listing.title,
          },
        });
      },
      error: () => this.actionLoading.set(false),
    });
  }

  async deleteListingFromDetail(): Promise<void> {
    const listing = this.listing();
    if (!listing) return;

    if (listing.purchaseId) {
      const proceed = await this.showPackageWarningAndTrack(listing, 'delete');
      if (!proceed) return;
    }

    this.actionLoading.set(true);
    this.listingsService.deleteListing(listing._id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.tracker.track(TrackingEvent.LISTING_DELETE, {
          productListingId: listing._id,
          metadata: { previousStatus: listing.status },
        });
        this.listing.set({ ...listing, status: 'deleted' as any });
      },
      error: () => this.actionLoading.set(false),
    });
  }

  private async showPackageWarningAndTrack(
    listing: Listing,
    actionType: 'delete' | 'deactivate',
  ): Promise<boolean> {
    const { purchaseId, packageName, packageType } = extractPackageDetails(listing);

    this.tracker.track(TrackingEvent.PACKAGE_CONFIRM_MODAL_SHOWN, {
      productListingId: listing._id,
      metadata: { listingId: listing._id, purchaseId, packageType, actionType },
    });

    const confirmed = await this.confirmModal.confirmPackageWarning({
      packageName,
      packageType,
      actionType,
    });

    if (confirmed) {
      this.tracker.track(TrackingEvent.PACKAGE_CONFIRM_MODAL_CONFIRMED, {
        productListingId: listing._id,
        metadata: { listingId: listing._id, purchaseId, packageType, actionType },
      });
    } else {
      this.tracker.track(TrackingEvent.PACKAGE_CONFIRM_MODAL_CANCELLED, {
        productListingId: listing._id,
        metadata: { listingId: listing._id, purchaseId, packageType, actionType },
      });
    }

    return confirmed;
  }
}
