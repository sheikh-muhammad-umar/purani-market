import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { Favorite, FavoriteListingPopulated } from '../../../core/models';

@Component({
  selector: 'app-favorites-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ListingUrlPipe],
  templateUrl: './favorites-list.component.html',
  styleUrls: ['./favorites-list.component.scss'],
})
export class FavoritesListComponent implements OnInit {
  readonly favorites = signal<Favorite[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly removingId = signal<string | null>(null);

  constructor(private readonly favoritesService: FavoritesService) {}

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
        this.error.set('Failed to load favorites. Please try again.');
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
    if (!listing) return 'assets/placeholder.png';
    return (
      listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png'
    );
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
    return `${listing.price.currency} ${listing.price.amount.toLocaleString()}`;
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
}
