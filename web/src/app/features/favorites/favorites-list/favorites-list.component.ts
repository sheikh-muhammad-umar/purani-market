import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ShortsService, ShortVideo } from '../../../core/services/shorts.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { Favorite, FavoriteListingPopulated } from '../../../core/models';
import { PLACEHOLDER_IMAGE, CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { TAB, TabType } from '../../../core/constants/enums';
import { ERROR_MSG } from '../../../core/constants/error-messages';

@Component({
  selector: 'app-favorites-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ListingUrlPipe],
  templateUrl: './favorites-list.component.html',
  styleUrls: ['./favorites-list.component.scss'],
})
export class FavoritesListComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly TAB = TAB;
  readonly SKELETON_ITEMS = [1, 2, 3, 4];
  readonly activeTab = signal<TabType>(TAB.ADS);
  readonly favorites = signal<Favorite[]>([]);
  readonly likedShorts = signal<ShortVideo[]>([]);
  readonly loading = signal(true);
  readonly loadingShorts = signal(false);
  readonly error = signal<string | null>(null);
  readonly removingId = signal<string | null>(null);

  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly shortsService: ShortsService,
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.loading.set(true);
    this.error.set(null);
    this.favoritesService.getAll().subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.favorites.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(ERROR_MSG.FAVORITES_LOAD_FAILED);
        this.loading.set(false);
      },
    });
  }

  getListing(favorite: Favorite): FavoriteListingPopulated | null {
    if (typeof favorite.productListingId === 'string') {
      return null;
    }
    return favorite.productListingId;
  }

  getImage(favorite: Favorite): string {
    const listing = this.getListing(favorite);
    if (!listing) return PLACEHOLDER_IMAGE;
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || PLACEHOLDER_IMAGE;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'sold':
        return 'badge-sold';
      case 'reserved':
        return 'badge-warning';
      case 'rejected':
        return 'badge-error';
      case 'pending_review':
        return 'badge-pending';
      default:
        return '';
    }
  }

  formatPrice(listing: FavoriteListingPopulated): string {
    return `${CURRENCY_SYMBOL} ${listing.price.amount.toLocaleString()}`;
  }

  removeFavorite(favorite: Favorite): void {
    this.removingId.set(favorite._id);
    this.favoritesService.remove(favorite._id).subscribe({
      next: () => {
        this.favorites.update((list) => list.filter((f) => f._id !== favorite._id));
        this.removingId.set(null);
      },
      error: () => {
        this.removingId.set(null);
      },
    });
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
    if (tab === TAB.SHORTS && this.likedShorts().length === 0) {
      this.loadLikedShorts();
    }
  }

  loadLikedShorts(): void {
    this.loadingShorts.set(true);
    this.shortsService.getMyLikedShorts().subscribe({
      next: (res) => {
        this.likedShorts.set(res.data ?? []);
        this.loadingShorts.set(false);
      },
      error: () => this.loadingShorts.set(false),
    });
  }

  removeShortLike(short: ShortVideo): void {
    this.shortsService.unlikeShort(short._id).subscribe({
      next: () => {
        this.likedShorts.update((list) => list.filter((s) => s._id !== short._id));
      },
    });
  }
}
