import { Component, OnInit, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ListingsService } from '../../../core/services/listings.service';
import { ShortsService, ShortVideo, ShortsStats } from '../../../core/services/shorts.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth';
import { Listing, PackagePurchase, User } from '../../../core/models';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  ListingStatus,
  PackageType,
  PaymentStatus,
  TAB,
  TabType,
} from '../../../core/constants/enums';
import { PLACEHOLDER_IMAGE, PAGE_SIZE_LARGE, CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { OWN_LISTING_VIEW_TABS, OwnListingView } from '../../../core/constants/own-listing-view';
import { extractPackageDetails } from '../../../core/utils/package-details';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { FormatStatusPipe } from '../../../shared/pipes/format-status.pipe';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { daysToMs } from '../../../core/utils/time';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import {
  StatTilesComponent,
  StatTile,
} from '../../../shared/components/stat-tiles/stat-tiles.component';
import {
  EngagementService,
  ItemEngagement,
  EMPTY_ENGAGEMENT,
} from '../../../core/services/engagement.service';

interface FeaturedAdInfo {
  listingId: string;
  title: string;
  expiresAt: Date;
}

@Component({
  selector: 'app-my-listings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ListingUrlPipe,
    FormatDurationPipe,
    FormatStatusPipe,
    AppLoaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    SkeletonComponent,
    StatTilesComponent,
  ],
  templateUrl: './my-listings.component.html',
  styleUrls: ['./my-listings.component.scss'],
})
export class MyListingsComponent implements OnInit {
  readonly ListingStatus = ListingStatus;
  readonly ROUTES = ROUTES;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly TAB = TAB;
  readonly SKELETON_ITEMS = [1, 2, 3, 4, 5];
  readonly mainTab = signal<TabType>(TAB.ADS);

  listings = signal<Listing[]>([]);
  shorts = signal<ShortVideo[]>([]);
  shortsStats = signal<ShortsStats | null>(null);
  loading = signal(true);
  loadingShorts = signal(false);
  total = signal(0);
  page = signal(1);
  user = signal<User | null>(null);
  purchases = signal<PackagePurchase[]>([]);
  confirmDeleteId = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  readonly VIEW_TABS = OWN_LISTING_VIEW_TABS;

  /** Which slice of the seller's ads is on screen. */
  readonly activeView = signal<OwnListingView>('all');
  /** How many ads sit in each view, for the tab badges. */
  readonly viewCounts = signal<Partial<Record<OwnListingView, number>>>({});

  /**
   * Tabs with their counts attached.
   *
   * Every tab is shown even at zero, so the set does not shift around as a
   * seller's ads move between states — a tab appearing and disappearing under the
   * cursor is worse than one reading 0. The count is omitted until it has
   * loaded rather than shown as 0, which would otherwise read as "no rejected
   * ads" a moment before saying there are two.
   */
  readonly viewTabs = computed(() =>
    this.VIEW_TABS.map((tab) => ({
      ...tab,
      count: this.viewCounts()[tab.view],
      selected: this.activeView() === tab.view,
    })),
  );

  /** Wording for an empty filter, so the message names the filter the seller chose. */
  readonly emptyViewTitle = computed(() => {
    const tab = this.VIEW_TABS.find((t) => t.view === this.activeView());
    return `No ${(tab?.label ?? 'matching').toLowerCase()} ads`;
  });

  readonly emptyViewIcon = computed(
    () => this.VIEW_TABS.find((t) => t.view === this.activeView())?.icon ?? 'inventory_2',
  );

  /** Per-listing engagement, keyed by listing id. */
  readonly listingEngagement = signal<Map<string, ItemEngagement>>(new Map());
  /** Per-short engagement, keyed by short id. */
  readonly shortsEngagement = signal<Map<string, ItemEngagement>>(new Map());

  /**
   * Headline figures across every listing the seller has.
   *
   * Summed from the engagement response rather than from the loaded page, so the
   * totals cover the whole account. The old cards added up `viewCount` on
   * whichever twenty rows happened to be on screen and called it "Total Views".
   */
  readonly analytics = computed<StatTile[]>(() => {
    const rows = [...this.listingEngagement().values()];
    const sum = (pick: (row: ItemEngagement) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);

    return [
      {
        label: 'Leads',
        value: sum((r) => r.leads),
        icon: 'person_check',
        hint: 'People who contacted you about a listing, counted once each however many times they got in touch.',
        emphasis: true,
      },
      { label: 'Views', value: sum((r) => r.views), icon: 'visibility' },
      { label: 'Likes', value: sum((r) => r.likes), icon: 'favorite' },
      { label: 'Chats', value: sum((r) => r.chats), icon: 'chat' },
      { label: 'Calls', value: sum((r) => r.calls), icon: 'call' },
      {
        label: 'Active Listings',
        value: this.listings().filter((l) => l.status === ListingStatus.ACTIVE).length,
        icon: 'inventory_2',
      },
    ];
  });

  /** The five figures for one listing, for the table's engagement cell. */
  listingTiles(listingId: string): StatTile[] {
    return this.itemTiles(this.listingEngagement().get(listingId));
  }

  /** The same for one short. */
  shortTiles(shortId: string): StatTile[] {
    return this.itemTiles(this.shortsEngagement().get(shortId));
  }

  private itemTiles(engagement?: ItemEngagement): StatTile[] {
    const stats = engagement ?? EMPTY_ENGAGEMENT;
    return [
      {
        label: 'Leads',
        value: stats.leads,
        icon: 'person_check',
        hint: 'Distinct people who tried to reach you about this item.',
        emphasis: true,
      },
      { label: 'Views', value: stats.views, icon: 'visibility' },
      { label: 'Likes', value: stats.likes, icon: 'favorite' },
      { label: 'Chats', value: stats.chats, icon: 'chat' },
      { label: 'Calls', value: stats.calls, icon: 'call' },
      { label: 'WhatsApp', value: stats.whatsapp, icon: 'sms' },
    ];
  }

  freeSlotLimit = computed(() => this.user()?.listingLimit ?? 10);
  activeListingCount = computed(() => this.user()?.activeListingCount ?? 0);

  paidSlots = computed(() => {
    const now = new Date();
    return this.purchases()
      .filter(
        (p) =>
          p.type === PackageType.AD_SLOTS &&
          p.paymentStatus === PaymentStatus.COMPLETED &&
          p.expiresAt &&
          new Date(p.expiresAt) > now,
      )
      .reduce((s, p) => s + (p.remainingQuantity || 0), 0);
  });

  totalSlots = computed(() => this.freeSlotLimit() + this.paidSlots());
  slotsUsed = computed(() => this.activeListingCount());
  slotPercent = computed(() => {
    const total = this.totalSlots();
    return total > 0 ? Math.min(100, Math.round((this.slotsUsed() / total) * 100)) : 0;
  });

  featuredAds = computed<FeaturedAdInfo[]>(() => {
    const now = new Date();
    return this.listings()
      .filter((l) => l.isFeatured && l.featuredUntil && new Date(l.featuredUntil) > now)
      .map((l) => ({ listingId: l._id, title: l.title, expiresAt: new Date(l.featuredUntil!) }));
  });

  /** Page count for the listings table. 1 or fewer hides the pagination control. */
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE_LARGE)));

  featuredSlotsRemaining = computed(() => {
    const now = new Date();
    return this.purchases()
      .filter(
        (p) =>
          p.type === PackageType.FEATURED_ADS &&
          p.paymentStatus === PaymentStatus.COMPLETED &&
          p.expiresAt &&
          new Date(p.expiresAt) > now,
      )
      .reduce((s, p) => s + (p.remainingQuantity || 0), 0);
  });

  private readonly isBrowser: boolean;

  constructor(
    private readonly listingsService: ListingsService,
    private readonly shortsService: ShortsService,
    private readonly packagesService: PackagesService,
    private readonly authService: AuthService,
    private readonly tracker: ActivityTrackerService,
    private readonly confirmModal: ConfirmModalService,
    private readonly toast: ToastService,
    private readonly route: ActivatedRoute,
    private readonly engagementService: EngagementService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      const tab = this.route.snapshot.queryParams['tab'];
      if (tab === TAB.SHORTS) {
        this.mainTab.set(TAB.SHORTS);
        this.loadShorts();
      }
      this.loadAll();
    }
  }

  loadAll(): void {
    this.loadListings();
    this.loadViewCounts();
    this.loadListingEngagement();
    this.loadUser();
    this.loadPurchases();
  }

  /**
   * Engagement for every listing, fetched once rather than per page.
   *
   * Kept separate from `loadListings` so paging the table does not refetch it,
   * and so a failure here leaves the table itself working — the numbers are
   * useful, not load-bearing.
   */
  private loadListingEngagement(): void {
    this.engagementService.getListingEngagement().subscribe({
      next: (byId) => this.listingEngagement.set(byId),
      error: () => this.listingEngagement.set(new Map()),
    });
  }

  /**
   * Switches filter tab.
   *
   * Resets to page one: staying on page three of Active while switching to
   * Rejected would ask for a page that view has no rows for and show an empty
   * table over a filter that does have matches.
   */
  selectView(view: OwnListingView): void {
    if (view === this.activeView()) return;
    this.activeView.set(view);
    this.page.set(1);
    this.loadListings();
  }

  loadListings(): void {
    this.loading.set(true);
    this.listingsService.getMyListings(this.page(), PAGE_SIZE_LARGE, this.activeView()).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.listings.set(data);
        this.total.set(res?.total ?? data.length);
        this.loading.set(false);
      },
      error: () => {
        this.listings.set([]);
        this.loading.set(false);
      },
    });
  }

  /**
   * Tab counts, refreshed alongside the table.
   *
   * Reloaded after actions that move an ad between views — deactivating or
   * deleting one — so a badge cannot keep claiming a state the ad has left.
   */
  private loadViewCounts(): void {
    this.listingsService.getMyViewCounts().subscribe({
      next: (counts) => this.viewCounts.set(counts),
      error: () => this.viewCounts.set({}),
    });
  }

  /** Jump to an absolute page number and reload the table. */
  loadPage(page: number): void {
    if (page === this.page()) return;
    this.page.set(page);
    this.loadListings();
  }

  loadUser(): void {
    this.authService.fetchCurrentUser().subscribe({
      next: (u) => this.user.set(u),
      error: () => {},
    });
  }

  loadPurchases(): void {
    this.packagesService.getMyPurchases().subscribe({
      next: (res: any) => this.purchases.set(Array.isArray(res) ? res : (res.data ?? [])),
      error: () => this.purchases.set([]),
    });
  }

  private static readonly STATUS_BADGE_MAP: Record<string, string> = {
    [ListingStatus.ACTIVE]: 'badge-success',
    [ListingStatus.INACTIVE]: 'badge-inactive',
    [ListingStatus.SOLD]: 'badge-sold',
    [ListingStatus.RESERVED]: 'badge-warning',
    [ListingStatus.REJECTED]: 'badge-error',
    [ListingStatus.PENDING_REVIEW]: 'badge-pending',
    [ListingStatus.EXPIRED]: 'badge-inactive',
  };

  getStatusBadgeClass(status: string): string {
    return MyListingsComponent.STATUS_BADGE_MAP[status] ?? '';
  }

  getImage(listing: Listing): string {
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || PLACEHOLDER_IMAGE;
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  daysUntil(date: Date | string): number {
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  markStatus(listing: Listing, status: ListingStatus): void {
    if (status === ListingStatus.INACTIVE && listing.purchaseId) {
      this.showPackageWarningAndProceed(listing, 'deactivate', () => {
        this.executeMarkStatus(listing, status);
      });
      return;
    }
    this.executeMarkStatus(listing, status);
  }

  private executeMarkStatus(listing: Listing, status: ListingStatus): void {
    this.actionLoading.set(listing._id);
    this.listingsService.updateStatus(listing._id, status).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.toast.success(`Listing marked as ${status}.`);
        this.tracker.track(TrackingEvent.LISTING_STATUS_CHANGE, {
          productListingId: listing._id,
          metadata: { previousStatus: listing.status, newStatus: status, title: listing.title },
        });
        this.loadListings();
        // The ad has just moved between views, so the badges are now stale.
        this.loadViewCounts();
      },
      error: () => {
        this.actionLoading.set(null);
        this.toast.error('Failed to update listing status.');
      },
    });
  }

  featureListing(listing: Listing): void {
    this.actionLoading.set(listing._id);
    this.listingsService.featureListing(listing._id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.toast.success('Listing featured successfully!');
        this.tracker.track(TrackingEvent.LISTING_FEATURE, {
          productListingId: listing._id,
          metadata: { title: listing.title, previousFeatured: false, newFeatured: true },
        });
        this.loadAll();
      },
      error: () => {
        this.actionLoading.set(null);
        this.toast.error('Failed to feature listing.');
      },
    });
  }

  confirmDelete(listingId: string): void {
    this.confirmDeleteId.set(listingId);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  deleteListing(listingId: string): void {
    const listing = this.listings().find((l) => l._id === listingId);
    if (listing?.purchaseId) {
      this.showPackageWarningAndProceed(listing, 'delete', () => {
        this.executeDeleteListing(listingId);
      });
      return;
    }
    this.executeDeleteListing(listingId);
  }

  private executeDeleteListing(listingId: string): void {
    this.actionLoading.set(listingId);
    this.confirmDeleteId.set(null);
    this.listingsService.deleteListing(listingId).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.toast.success('Listing deleted.');
        this.tracker.track(TrackingEvent.LISTING_DELETE, {
          productListingId: listingId,
          metadata: { previousStatus: this.listings().find((l) => l._id === listingId)?.status },
        });
        this.loadAll();
      },
      error: () => {
        this.actionLoading.set(null);
        this.toast.error('Failed to delete listing.');
      },
    });
  }

  private async showPackageWarningAndProceed(
    listing: Listing,
    actionType: 'delete' | 'deactivate',
    onConfirm: () => void,
  ): Promise<void> {
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
      onConfirm();
    } else {
      this.tracker.track(TrackingEvent.PACKAGE_CONFIRM_MODAL_CANCELLED, {
        productListingId: listing._id,
        metadata: { listingId: listing._id, purchaseId, packageType, actionType },
      });
    }
  }

  // ─── Shorts Tab ─────────────────────────────────────────
  switchMainTab(tab: TabType): void {
    this.mainTab.set(tab);
    if (tab === TAB.SHORTS && this.shorts().length === 0) {
      this.loadShorts();
    }
  }

  loadShorts(): void {
    this.loadingShorts.set(true);
    this.shortsService.getMyShorts(1, 50).subscribe({
      next: (res) => {
        this.shorts.set(res.data ?? []);
        this.loadingShorts.set(false);
      },
      error: () => this.loadingShorts.set(false),
    });
    this.shortsService.getMyStats().subscribe({
      next: (stats) => this.shortsStats.set(stats),
    });
    this.engagementService.getShortsEngagement().subscribe({
      next: (byId) => this.shortsEngagement.set(byId),
      error: () => this.shortsEngagement.set(new Map()),
    });
  }

  async deleteShort(id: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Delete Short',
      message:
        "Are you sure you want to delete this short? This action cannot be undone and won't restore your monthly upload limit.",
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      this.shortsService.deleteShort(id).subscribe({
        next: () => {
          this.tracker.track(TrackingEvent.SHORT_DELETE, { metadata: { shortId: id } });
          this.shorts.update((list) => list.filter((s) => s._id !== id));
          this.loadShorts();
        },
      });
    }
  }

  isShortExpiringSoon(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < daysToMs(2);
  }
}
