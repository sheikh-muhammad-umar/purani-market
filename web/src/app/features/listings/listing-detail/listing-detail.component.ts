import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ListingsService, ListingsResponse } from '../../../core/services/listings.service';
import { ReviewsService, ReviewsResponse } from '../../../core/services/reviews.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginModalService } from '../../../shared/components/login-modal/login-modal.service';
import { CategoryAttribute, Listing, Review } from '../../../core/models';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { VerificationBadgesComponent } from '../../../shared/components/verification-badges/verification-badges.component';
import { ListingCardComponent } from '../../../shared/components/listing-card/listing-card.component';
import { extractIdFromSlug, slugify } from '../../../core/utils/slug';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  PLACEHOLDER_IMAGE,
  CURRENCY_SYMBOL,
  VERIFIED_SELLER_TOOLTIP,
} from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { ListingStatus } from '../../../core/constants/enums';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { buildMapEmbedUrl } from '../../../core/utils/map-link';
import { extractPackageDetails } from '../../../core/utils/package-details';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';
import { AdSlotComponent } from '../../../shared/components/ad-slot/ad-slot.component';
import {
  StatTilesComponent,
  StatTile,
} from '../../../shared/components/stat-tiles/stat-tiles.component';
import {
  EngagementService,
  ItemEngagement,
  EMPTY_ENGAGEMENT,
} from '../../../core/services/engagement.service';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal.component';
import { ReportTargetType } from '../../../core/models/report.model';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';

/**
 * One row of the listing "Details" table.
 *
 * `filterValue` is the single, raw value that round-trips cleanly to a `/search`
 * attribute filter (e.g. `Automatic`, `Toyota`, `2021`). It is `null` for
 * composite values — multiselect lists, `{min,max}` ranges — whose rendered
 * `value` string cannot be filtered on as-is, so those rows render as plain text.
 */
interface DetailAttributeRow {
  key: string;
  label: string;
  value: string;
  filterValue: string | null;
}

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PriceFormatPipe,
    VerificationBadgesComponent,
    ListingCardComponent,
    AppLoaderComponent,
    AdSlotComponent,
    StatTilesComponent,
    ReportModalComponent,
    StarRatingComponent,
  ],
  templateUrl: './listing-detail.component.html',
  styleUrls: ['./listing-detail.component.scss'],
})
export class ListingDetailComponent implements OnInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly VERIFIED_SELLER_TOOLTIP = VERIFIED_SELLER_TOOLTIP;
  readonly ListingStatus = ListingStatus;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly TrackingEvent = TrackingEvent;
  listing = signal<Listing | null>(null);
  loading = signal(true);
  error = signal('');
  currentImageIndex = signal(0);

  readonly sellerPath = computed(() => {
    const l = this.listing();
    if (!l?.sellerId) return '';
    const name = l.sellerName || 'seller';
    const slug = slugify(name);
    return `/seller/${slug}-${l.sellerId}`;
  });

  /**
   * Whether to show the "Verified" seal next to the seller name.
   *
   * The seal must agree with the email/phone/ID badges shown beneath it, so it
   * is derived from the same per-channel flags (verified = all three) whenever
   * those are present. Only when the granular flags are absent from the
   * response do we fall back to the denormalized `sellerVerified` boolean.
   */
  readonly sellerVerified = computed(() => {
    const l = this.listing();
    if (!l) return false;
    const hasGranular =
      l.sellerEmailVerified !== undefined ||
      l.sellerPhoneVerified !== undefined ||
      l.sellerIdVerified !== undefined;
    if (hasGranular) {
      return !!l.sellerEmailVerified && !!l.sellerPhoneVerified && !!l.sellerIdVerified;
    }
    return !!l.sellerVerified;
  });

  // Reviews
  reviews = signal<Review[]>([]);
  averageRating = signal(0);
  totalReviews = signal(0);

  // Favorites
  isFavorited = signal(false);
  favoriteId = signal<string | null>(null);
  favoriteAnimating = signal(false);

  // Share
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

  /**
   * Whether the fixed mobile contact bar should be shown.
   *
   * On mobile the price card is reordered to sit just under the title, so the
   * bar would duplicate a CTA that's already on screen. It is revealed only
   * once that card scrolls out of view.
   */
  readonly contactBarVisible = signal(false);

  /**
   * Whether the seller's phone number has been revealed. Starts hidden so the
   * Call button first shows a "Call" label; the first tap reveals the number
   * (turning the button into a `tel:` link that opens the phone app), and a
   * second tap dials it.
   */
  readonly phoneRevealed = signal(false);

  private priceCardObserver?: IntersectionObserver;

  /**
   * Setter rather than a signal query with `effect()` on purpose: the spec
   * constructs this component with `new`, which is outside an injection
   * context. Angular only calls this setter during change detection, so manual
   * construction is unaffected.
   */
  @ViewChild('priceCard')
  set priceCardRef(ref: ElementRef<HTMLElement> | undefined) {
    this.observePriceCard(ref?.nativeElement);
  }

  private observePriceCard(el: HTMLElement | undefined): void {
    this.priceCardObserver?.disconnect();
    this.priceCardObserver = undefined;

    // Absent during server-side rendering
    if (!el || typeof IntersectionObserver === 'undefined') return;

    this.priceCardObserver = new IntersectionObserver(
      (entries) => this.contactBarVisible.set(!entries[0].isIntersecting),
      { threshold: 0 },
    );
    this.priceCardObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.priceCardObserver?.disconnect();
    // Collapse the Call button back to its "Call" label so the number is not
    // pre-revealed if this view is revisited.
    this.phoneRevealed.set(false);
  }

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
    private readonly toast: ToastService,
    private readonly engagementService: EngagementService,
    private readonly categoriesService?: CategoriesService,
    private readonly locationService?: LocationService,
  ) {}

  /**
   * Attribute definitions for this listing's category, in the order an admin
   * authored them. Empty when the lookup fails, in which case the details table
   * falls back to humanising the raw attribute keys.
   */
  categoryAttributeDefs = signal<CategoryAttribute[]>([]);

  /** Resolved "Province, City" labels for `province_city` attributes, keyed by attribute key. */
  private provinceCityLabels = signal<Record<string, string>>({});

  /**
   * Rows for the details table.
   *
   * Previously the template piped the raw `categoryAttributes` record through
   * `keyvalue`, which sorted the fields alphabetically and labelled them from the
   * storage key ("Body Type" from `body_type`) rather than the admin-authored
   * name. It also dropped arrays and booleans entirely, so multiselect answers
   * and yes/no attributes never appeared. This rebuilds the rows from the
   * category definition: authored order, real names, units, and every type
   * rendered. Keys present on the listing but no longer defined by the category
   * are appended so historic data is never silently hidden.
   */
  readonly detailAttributeRows = computed<DetailAttributeRow[]>(() => {
    const listing = this.listing();
    if (!listing?.categoryAttributes) return [];

    const stored = listing.categoryAttributes;
    const defs = this.categoryAttributeDefs();
    const rows: DetailAttributeRow[] = [];
    const seen = new Set<string>();

    for (const def of defs) {
      seen.add(def.key);
      if (!(def.key in stored)) continue;
      const value = this.formatAttributeValue(def.key, stored[def.key], def);
      if (value === '') continue;
      rows.push({
        key: def.key,
        label: def.unit ? `${def.name} (${def.unit})` : def.name,
        value,
        filterValue: this.attributeFilterValue(stored[def.key], def),
      });
    }

    for (const [key, raw] of Object.entries(stored)) {
      if (seen.has(key)) continue;
      const value = this.formatAttributeValue(key, raw);
      if (value === '') continue;
      rows.push({
        key,
        label: this.formatLabel(key),
        value,
        filterValue: this.attributeFilterValue(raw),
      });
    }

    return rows;
  });

  /** Category slug used to scope attribute-filter links to the right category on /search. */
  readonly categorySlug = signal('');

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

  // ── Reporting ─────────────────────────────────────────────────
  readonly ReportTargetType = ReportTargetType;
  readonly showReportModal = signal(false);

  /** Open the report dialog, sending the user through login first if needed. */
  openReport(): void {
    const listing = this.listing();
    if (!listing) return;
    if (!this.authService.isAuthenticated()) {
      this.loginModal.open(`/listings/${listing._id}`);
      return;
    }
    this.showReportModal.set(true);
  }

  closeReport(): void {
    this.showReportModal.set(false);
  }

  /** This listing's engagement, loaded only for its owner. */
  readonly ownerEngagement = signal<ItemEngagement | null>(null);

  /**
   * Fetches engagement when the viewer owns the listing.
   *
   * Skipped for everybody else so a buyer's page load does not pay for a query
   * whose result they are not allowed to see. The endpoint is scoped server-side
   * regardless.
   */
  private loadOwnerEngagement(listing: Listing): void {
    const user = this.authService.user();
    if (!user || user._id !== listing.sellerId) {
      this.ownerEngagement.set(null);
      return;
    }

    this.engagementService.getListingEngagement().subscribe({
      next: (byId) => this.ownerEngagement.set(byId.get(listing._id) ?? null),
      error: () => this.ownerEngagement.set(null),
    });
  }

  /**
   * Performance figures shown to the seller on their own listing.
   *
   * Here as well as on the listings table because this is the page a seller
   * actually opens to check on an ad, and it is where they decide whether to
   * promote it.
   */
  readonly ownerTiles = computed<StatTile[]>(() => {
    const stats = this.ownerEngagement() ?? EMPTY_ENGAGEMENT;
    return [
      {
        label: 'Leads',
        value: stats.leads,
        icon: 'person_check',
        hint: 'Distinct people who tried to reach you about this listing, counted once each.',
        emphasis: true,
      },
      { label: 'Views', value: stats.views, icon: 'visibility' },
      { label: 'Likes', value: stats.likes, icon: 'favorite' },
      { label: 'Chats', value: stats.chats, icon: 'chat' },
      { label: 'Calls', value: stats.calls, icon: 'call' },
      { label: 'WhatsApp', value: stats.whatsapp, icon: 'sms' },
    ];
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
        this.phoneRevealed.set(false);
        this.loading.set(false);
        this.loadReviews(listing._id);
        this.loadSimilarListings(listing.categoryId);
        this.loadCategoryAttributeDefs(listing.categoryId);
        this.checkFavoriteStatus(listing._id);
        this.loadOwnerEngagement(listing);
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
    this.favoritesService.check(listingId).subscribe({
      next: (res) => {
        this.isFavorited.set(res.isFavorited);
        this.favoriteId.set(res.favoriteId ?? null);
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
  formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Query params for a clickable attribute value, e.g. `{ category: 'cars',
   * transmission: 'Automatic' }`. The search page reads any non-standard param
   * as a category-attribute filter keyed by the attribute's own key, so this is
   * all that's needed to land on the matching, category-scoped results.
   */
  attributeQueryParams(row: DetailAttributeRow): Record<string, string> {
    const params: Record<string, string> = {};
    const slug = this.categorySlug();
    if (slug) params['category'] = slug;
    if (row.filterValue) params[row.key] = row.filterValue;
    return params;
  }

  /**
   * Renders a stored attribute value as display text. Returns `''` for values
   * that carry no information so the caller can omit the row.
   */
  private formatAttributeValue(key: string, raw: unknown, def?: CategoryAttribute): string {
    if (raw === null || raw === undefined) return '';

    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';

    if (Array.isArray(raw)) {
      const items = raw.filter((v) => v !== null && v !== undefined && v !== '');
      return items.length > 0 ? items.join(', ') : '';
    }

    if (typeof raw === 'object') {
      const record = raw as Record<string, unknown>;

      if ('provinceId' in record || 'cityId' in record) {
        // Names are stored alongside the ids, so no lookup is needed. Older
        // listings that predate that only have ids, in which case the
        // asynchronously resolved label is used.
        const province = typeof record['province'] === 'string' ? record['province'] : '';
        const city = typeof record['city'] === 'string' ? record['city'] : '';
        if (province && city) return `${province}, ${city}`;
        if (city) return city;
        if (province) return province;
        return this.provinceCityLabels()[key] ?? '';
      }

      if ('min' in record || 'max' in record) {
        const min = record['min'];
        const max = record['max'];
        const hasMin = min !== null && min !== undefined && min !== '';
        const hasMax = max !== null && max !== undefined && max !== '';
        if (hasMin && hasMax) return `${min} – ${max}`;
        if (hasMin) return `${min}+`;
        if (hasMax) return `Up to ${max}`;
        return '';
      }

      return '';
    }

    const text = String(raw).trim();
    if (text === '') return '';
    // `def` is unused for scalars today but keeps the signature stable for
    // type-specific formatting (e.g. thousands separators) later.
    void def;
    return text;
  }

  /**
   * The single value that filters cleanly on `/search` for this attribute, or
   * `null` when the attribute cannot round-trip to one filter param.
   *
   * The search page keys attribute filters by the attribute's own key and
   * expects one scalar value per key. Scalars (text/select/number/year) pass
   * through as-is. `province_city` is stored as `{ province, city }` and indexed
   * as the most specific place name, so it filters by the province (matching the
   * requested "Registration City: Punjab, Multan -> all Punjab" behaviour).
   * Multiselect arrays, `{min,max}` ranges and booleans have no meaningful
   * single-value filter, so they stay as plain text.
   */
  private attributeFilterValue(raw: unknown, def?: CategoryAttribute): string | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'boolean') return null;
    if (Array.isArray(raw)) return null;

    if (typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      if ('provinceId' in record || 'cityId' in record) {
        const province = typeof record['province'] === 'string' ? record['province'].trim() : '';
        if (province) return province;
        // Older listings store only ids; fall back to the resolved label's
        // leading province segment when available.
        const label = this.provinceCityLabels()[def?.key ?? ''] ?? '';
        const provinceFromLabel = label.split(',')[0]?.trim();
        return provinceFromLabel || null;
      }
      // `{min,max}` ranges and any other object shape are not single-value.
      return null;
    }

    const text = String(raw).trim();
    return text === '' ? null : text;
  }

  /**
   * Loads the category's attribute definitions so the details table can use the
   * admin-authored names, units and ordering instead of raw storage keys.
   *
   * Guarded and failure-tolerant: if the category was removed or the request
   * fails, the table still renders from the listing's own data.
   */
  private loadCategoryAttributeDefs(categoryId: string): void {
    if (!this.categoriesService || !categoryId) return;
    this.categoriesService.getInheritedAttributes(categoryId).subscribe({
      next: ({ attributes }) => {
        this.categoryAttributeDefs.set(attributes ?? []);
        this.resolveProvinceCityLabels(attributes ?? []);
      },
      error: () => {
        /* keep the key-based fallback */
      },
    });

    // Resolve the category slug so attribute-value links can scope the search to
    // this category. Without a slug the links still work but search the whole
    // catalogue; scoping keeps results relevant.
    this.categoriesService.getById(categoryId).subscribe({
      next: (category) => this.categorySlug.set(category?.slug ?? ''),
      error: () => {
        /* unscoped links are an acceptable fallback */
      },
    });
  }

  /** Turns `{ provinceId, cityId }` attribute values into "Province, City" text. */
  private resolveProvinceCityLabels(defs: CategoryAttribute[]): void {
    const stored = this.listing()?.categoryAttributes;
    if (!this.locationService || !stored) return;

    const targets = defs.filter((d) => d.type === 'province_city' && d.key in stored);
    if (targets.length === 0) return;

    this.locationService.getProvinces().subscribe({
      next: (provinces) => {
        for (const def of targets) {
          const value = stored[def.key] as { provinceId?: string; cityId?: string } | null;
          if (!value?.provinceId) continue;
          const province = provinces.find((p) => p._id === value.provinceId);
          if (!province) continue;

          this.provinceCityLabels.update((map) => ({ ...map, [def.key]: province.name }));
          if (!value.cityId) continue;

          this.locationService!.getCities(value.provinceId).subscribe({
            next: (cities) => {
              const city = cities.find((c) => c._id === value.cityId);
              if (!city) return;
              this.provinceCityLabels.update((map) => ({
                ...map,
                [def.key]: `${province.name}, ${city.name}`,
              }));
            },
            error: () => {
              /* province-only label already set */
            },
          });
        }
      },
      error: () => {
        /* leave province_city rows out rather than showing ids */
      },
    });
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
        this.toast.success('Link copied to clipboard');
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
        this.toast.success('Listing deactivated successfully.');
        this.tracker.track(TrackingEvent.LISTING_STATUS_CHANGE, {
          productListingId: listing._id,
          metadata: {
            previousStatus: listing.status,
            newStatus: ListingStatus.INACTIVE,
            title: listing.title,
          },
        });
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.error('Failed to deactivate listing. Please try again.');
      },
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
        this.toast.success('Listing deleted successfully.');
        this.tracker.track(TrackingEvent.LISTING_DELETE, {
          productListingId: listing._id,
          metadata: { previousStatus: listing.status },
        });
        this.listing.set({ ...listing, status: 'deleted' as any });
      },
      error: () => {
        this.actionLoading.set(false);
        this.toast.error('Failed to delete listing. Please try again.');
      },
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

  getWhatsAppLink(phone: string, title: string): string {
    const cleaned = phone.replace(/[^0-9+]/g, '').replace(/^0/, '92');
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const message = encodeURIComponent(
      `Hi, I'm interested in your listing: "${title}" on Marketplace.\n${url}`,
    );
    return `https://wa.me/${cleaned}?text=${message}`;
  }

  trackContact(listingId: string, type: string): void {
    this.tracker.track(TrackingEvent.CONTACT, {
      productListingId: listingId,
      metadata: { type },
    });
  }

  /**
   * First tap on the Call button reveals the phone number instead of dialling.
   * Returns whether the number was just revealed (i.e. the dial should be
   * suppressed for this tap). Once revealed, subsequent taps fall through to
   * the `tel:` link so the phone app opens.
   */
  revealPhone(listingId: string): boolean {
    if (this.phoneRevealed()) {
      return false;
    }
    this.phoneRevealed.set(true);
    this.trackContact(listingId, 'call');
    return true;
  }
}
