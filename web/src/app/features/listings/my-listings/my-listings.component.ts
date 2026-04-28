import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ListingsService } from '../../../core/services/listings.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth';
import { Listing, PackagePurchase, User } from '../../../core/models';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ListingStatus, PackageType, PaymentStatus } from '../../../core/constants/enums';
import { PLACEHOLDER_IMAGE, PAGE_SIZE_LARGE } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { extractPackageDetails } from '../../../core/utils/package-details';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';

interface AnalyticsCard {
  label: string;
  value: number;
  icon: string;
}

interface FeaturedAdInfo {
  listingId: string;
  title: string;
  expiresAt: Date;
}

@Component({
  selector: 'app-my-listings',
  standalone: true,
  imports: [CommonModule, RouterLink, ListingUrlPipe],
  templateUrl: './my-listings.component.html',
  styleUrls: ['./my-listings.component.scss'],
})
export class MyListingsComponent implements OnInit {
  readonly ListingStatus = ListingStatus;
  readonly ROUTES = ROUTES;

  listings = signal<Listing[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  user = signal<User | null>(null);
  purchases = signal<PackagePurchase[]>([]);
  confirmDeleteId = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  analytics = computed<AnalyticsCard[]>(() => {
    const items = this.listings();
    return [
      {
        label: 'Total Views',
        value: items.reduce((s, l) => s + (l.viewCount || 0), 0),
        icon: 'visibility',
      },
      {
        label: 'Total Favorites',
        value: items.reduce((s, l) => s + (l.favoriteCount || 0), 0),
        icon: 'favorite',
      },
      {
        label: 'Active Listings',
        value: items.filter((l) => l.status === ListingStatus.ACTIVE).length,
        icon: 'inventory_2',
      },
    ];
  });

  freeSlotLimit = computed(() => this.user()?.adLimit ?? 10);
  activeAdCount = computed(() => this.user()?.activeAdCount ?? 0);

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
  slotsUsed = computed(() => this.activeAdCount());
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

  constructor(
    private readonly listingsService: ListingsService,
    private readonly packagesService: PackagesService,
    private readonly authService: AuthService,
    private readonly tracker: ActivityTrackerService,
    private readonly confirmModal: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadListings();
    this.loadUser();
    this.loadPurchases();
  }

  loadListings(): void {
    this.loading.set(true);
    this.listingsService.getMyListings(this.page(), PAGE_SIZE_LARGE).subscribe({
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
        this.tracker.track(TrackingEvent.LISTING_STATUS_CHANGE, {
          productListingId: listing._id,
          metadata: { previousStatus: listing.status, newStatus: status, title: listing.title },
        });
        this.loadListings();
      },
      error: () => this.actionLoading.set(null),
    });
  }

  featureListing(listing: Listing): void {
    this.actionLoading.set(listing._id);
    this.listingsService.featureListing(listing._id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.tracker.track(TrackingEvent.LISTING_FEATURE, {
          productListingId: listing._id,
          metadata: { title: listing.title, previousFeatured: false, newFeatured: true },
        });
        this.loadAll();
      },
      error: () => this.actionLoading.set(null),
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
        this.tracker.track(TrackingEvent.LISTING_DELETE, {
          productListingId: listingId,
          metadata: { previousStatus: this.listings().find((l) => l._id === listingId)?.status },
        });
        this.loadAll();
      },
      error: () => this.actionLoading.set(null),
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
}
