import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ListingsService } from '../../../core/services/listings.service';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth';
import { Listing, PackagePurchase, User } from '../../../core/models';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './my-listings.component.html',
  styleUrls: ['./my-listings.component.scss'],
})
export class MyListingsComponent implements OnInit {
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
      { label: 'Total Views', value: items.reduce((s, l) => s + (l.viewCount || 0), 0), icon: '👁' },
      { label: 'Total Favorites', value: items.reduce((s, l) => s + (l.favoriteCount || 0), 0), icon: '❤️' },
      { label: 'Active Listings', value: items.filter(l => l.status === 'active').length, icon: '📦' },
    ];
  });

  freeSlotLimit = computed(() => this.user()?.adLimit ?? 10);
  activeAdCount = computed(() => this.user()?.activeAdCount ?? 0);

  paidSlots = computed(() => {
    const now = new Date();
    return this.purchases()
      .filter(p => p.type === 'ad_slots' && p.paymentStatus === 'completed' && p.expiresAt && new Date(p.expiresAt) > now)
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
      .filter(l => l.isFeatured && l.featuredUntil && new Date(l.featuredUntil) > now)
      .map(l => ({ listingId: l._id, title: l.title, expiresAt: new Date(l.featuredUntil!) }));
  });

  featuredSlotsRemaining = computed(() => {
    const now = new Date();
    return this.purchases()
      .filter(p => p.type === 'featured_ads' && p.paymentStatus === 'completed' && p.expiresAt && new Date(p.expiresAt) > now)
      .reduce((s, p) => s + (p.remainingQuantity || 0), 0);
  });

  constructor(
    private readonly listingsService: ListingsService,
    private readonly packagesService: PackagesService,
    private readonly authService: AuthService,
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
    this.listingsService.getMyListings(this.page(), 50).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data ?? [];
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
      next: (res: any) => this.purchases.set(Array.isArray(res) ? res : res.data ?? []),
      error: () => this.purchases.set([]),
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'inactive': return 'badge-inactive';
      case 'sold': return 'badge-sold';
      case 'reserved': return 'badge-warning';
      case 'rejected': return 'badge-error';
      case 'pending_review': return 'badge-pending';
      default: return '';
    }
  }

  getImage(listing: Listing): string {
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  daysUntil(date: Date | string): number {
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  markStatus(listing: Listing, status: 'sold' | 'reserved' | 'inactive' | 'active'): void {
    this.actionLoading.set(listing._id);
    this.listingsService.updateStatus(listing._id, status).subscribe({
      next: () => {
        this.actionLoading.set(null);
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
    this.actionLoading.set(listingId);
    this.confirmDeleteId.set(null);
    this.listingsService.deleteListing(listingId).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.loadAll();
      },
      error: () => this.actionLoading.set(null),
    });
  }
}
