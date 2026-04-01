import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FavoritesListComponent } from './favorites-list.component';
import { FavoritesService } from '../../../core/services/favorites.service';
import { Favorite, FavoriteListingPopulated } from '../../../core/models';

function makeListing(overrides: Partial<FavoriteListingPopulated> = {}): FavoriteListingPopulated {
  return {
    _id: overrides._id ?? 'listing1',
    title: overrides.title ?? 'Test Product',
    price: overrides.price ?? { amount: 5000, currency: 'PKR' },
    status: overrides.status ?? 'active',
    images: overrides.images ?? [{ url: 'img.jpg', thumbnailUrl: 'thumb.jpg', sortOrder: 0 }],
    condition: overrides.condition ?? 'used',
    location: overrides.location ?? { type: 'Point', coordinates: [74, 31], city: 'Lahore', area: 'DHA' },
    createdAt: overrides.createdAt ?? new Date('2024-06-01'),
    isFeatured: overrides.isFeatured ?? false,
  };
}

function makeFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    _id: overrides._id ?? 'fav1',
    userId: overrides.userId ?? 'user1',
    productListingId: overrides.productListingId ?? makeListing(),
    createdAt: overrides.createdAt ?? new Date('2024-06-15'),
  };
}

describe('FavoritesListComponent', () => {
  let component: FavoritesListComponent;
  let favoritesService: {
    getAll: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const mockFavorites: Favorite[] = [
    makeFavorite({ _id: 'fav1', productListingId: makeListing({ _id: 'l1', title: 'Car', price: { amount: 500000, currency: 'PKR' }, status: 'active' }) }),
    makeFavorite({ _id: 'fav2', productListingId: makeListing({ _id: 'l2', title: 'Phone', price: { amount: 25000, currency: 'PKR' }, status: 'sold' }) }),
    makeFavorite({ _id: 'fav3', productListingId: makeListing({ _id: 'l3', title: 'Laptop', price: { amount: 120000, currency: 'PKR' }, status: 'reserved' }) }),
  ];

  beforeEach(() => {
    favoritesService = {
      getAll: vi.fn().mockReturnValue(of({ data: mockFavorites, total: 3 })),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };

    component = new FavoritesListComponent(
      favoritesService as unknown as FavoritesService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load favorites on init', () => {
    component.ngOnInit();
    expect(favoritesService.getAll).toHaveBeenCalled();
    expect(component.favorites().length).toBe(3);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should handle load error', () => {
    favoritesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.favorites().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load favorites. Please try again.');
  });

  it('should extract populated listing from favorite', () => {
    component.ngOnInit();
    const listing = component.getListing(component.favorites()[0]);
    expect(listing).not.toBeNull();
    expect(listing!.title).toBe('Car');
  });

  it('should return null for unpopulated listing', () => {
    const fav = makeFavorite({ productListingId: 'some-id' as any });
    expect(component.getListing(fav)).toBeNull();
  });

  it('should return thumbnail image url', () => {
    component.ngOnInit();
    const url = component.getImage(component.favorites()[0]);
    expect(url).toBe('thumb.jpg');
  });

  it('should fallback to full url when no thumbnail', () => {
    const fav = makeFavorite({
      productListingId: makeListing({ images: [{ url: 'full.jpg', thumbnailUrl: '', sortOrder: 0 }] }),
    });
    expect(component.getImage(fav)).toBe('full.jpg');
  });

  it('should fallback to placeholder when no images', () => {
    const fav = makeFavorite({
      productListingId: makeListing({ images: [] }),
    });
    expect(component.getImage(fav)).toBe('assets/placeholder.png');
  });

  it('should return placeholder for unpopulated listing', () => {
    const fav = makeFavorite({ productListingId: 'some-id' as any });
    expect(component.getImage(fav)).toBe('assets/placeholder.png');
  });

  it('should return correct badge class for each status', () => {
    expect(component.getStatusBadgeClass('active')).toBe('badge-success');
    expect(component.getStatusBadgeClass('sold')).toBe('badge-sold');
    expect(component.getStatusBadgeClass('reserved')).toBe('badge-warning');
    expect(component.getStatusBadgeClass('rejected')).toBe('badge-error');
    expect(component.getStatusBadgeClass('pending_review')).toBe('badge-pending');
    expect(component.getStatusBadgeClass('unknown')).toBe('');
  });

  it('should format price correctly', () => {
    const listing = makeListing({ price: { amount: 500000, currency: 'PKR' } });
    const formatted = component.formatPrice(listing);
    expect(formatted).toContain('PKR');
    expect(formatted).toContain('500');
  });

  it('should remove favorite and update list', () => {
    component.ngOnInit();
    expect(component.favorites().length).toBe(3);
    component.removeFavorite(component.favorites()[0]);
    expect(favoritesService.remove).toHaveBeenCalledWith('fav1');
    expect(component.favorites().length).toBe(2);
    expect(component.removingId()).toBeNull();
  });

  it('should handle remove error gracefully', () => {
    favoritesService.remove.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.removeFavorite(component.favorites()[0]);
    expect(component.favorites().length).toBe(3); // unchanged
    expect(component.removingId()).toBeNull();
  });

  it('should show empty state when no favorites', () => {
    favoritesService.getAll.mockReturnValue(of({ data: [], total: 0 }));
    component.ngOnInit();
    expect(component.favorites().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should retry loading on loadFavorites call', () => {
    favoritesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).not.toBeNull();

    favoritesService.getAll.mockReturnValue(of({ data: mockFavorites, total: 3 }));
    component.loadFavorites();
    expect(component.error()).toBeNull();
    expect(component.favorites().length).toBe(3);
  });
});
