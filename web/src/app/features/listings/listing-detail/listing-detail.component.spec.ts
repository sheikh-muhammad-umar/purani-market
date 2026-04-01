import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListingDetailComponent } from './listing-detail.component';
import { ListingsService } from '../../../core/services/listings.service';
import { ReviewsService } from '../../../core/services/reviews.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Listing } from '../../../core/models';

const mockListing: Listing = {
  _id: 'listing-1',
  sellerId: 'seller-1',
  title: 'Toyota Corolla 2020',
  description: 'Well-maintained car',
  price: { amount: 1250000, currency: 'PKR' },
  categoryId: 'cat-1',
  categoryPath: ['cat-root', 'cat-1'],
  condition: 'used',
  categoryAttributes: { Make: 'Toyota', Model: 'Corolla', Year: '2020' },
  images: [
    { url: 'img1.jpg', thumbnailUrl: 'thumb1.jpg', sortOrder: 0 },
    { url: 'img2.jpg', thumbnailUrl: 'thumb2.jpg', sortOrder: 1 },
    { url: 'img3.jpg', thumbnailUrl: 'thumb3.jpg', sortOrder: 2 },
  ],
  location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'Johar Town' },
  contactInfo: { phone: '03001234567', email: 'seller@test.com' },
  status: 'active',
  isFeatured: true,
  viewCount: 456,
  favoriteCount: 23,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ListingDetailComponent', () => {
  let component: ListingDetailComponent;
  let listingsServiceMock: any;
  let reviewsServiceMock: any;
  let favoritesServiceMock: any;
  let routeMock: any;
  let sanitizerMock: any;

  beforeEach(() => {
    listingsServiceMock = {
      getById: vi.fn().mockReturnValue(of(mockListing)),
      getByCategory: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 8 })),
    };

    reviewsServiceMock = {
      getByListing: vi.fn().mockReturnValue(of({ data: [], averageRating: 0, total: 0 })),
    };

    favoritesServiceMock = {
      check: vi.fn().mockReturnValue(of({ isFavorited: false })),
      add: vi.fn().mockReturnValue(of({ _id: 'fav-1', userId: 'u1', productListingId: 'listing-1', createdAt: new Date() })),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };

    routeMock = {
      snapshot: { paramMap: { get: (_key: string) => 'listing-1' } },
    };

    sanitizerMock = {
      bypassSecurityTrustResourceUrl: vi.fn((url: string) => ({ safeUrl: url })),
    };

    component = new ListingDetailComponent(
      routeMock as unknown as ActivatedRoute,
      listingsServiceMock as unknown as ListingsService,
      reviewsServiceMock as unknown as ReviewsService,
      favoritesServiceMock as unknown as FavoritesService,
      sanitizerMock as unknown as DomSanitizer,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load listing on init', () => {
    component.ngOnInit();
    expect(listingsServiceMock.getById).toHaveBeenCalledWith('listing-1');
    expect(component.listing()).toEqual(mockListing);
    expect(component.loading()).toBe(false);
  });

  it('should set error when no id in route', () => {
    routeMock.snapshot.paramMap.get = () => null;
    component = new ListingDetailComponent(
      routeMock as unknown as ActivatedRoute,
      listingsServiceMock as unknown as ListingsService,
      reviewsServiceMock as unknown as ReviewsService,
      favoritesServiceMock as unknown as FavoritesService,
      sanitizerMock as unknown as DomSanitizer,
    );
    component.ngOnInit();
    expect(component.error()).toBe('Listing not found');
    expect(component.loading()).toBe(false);
  });

  it('should set error on listing load failure', () => {
    listingsServiceMock.getById.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).toBe('Failed to load listing');
    expect(component.loading()).toBe(false);
  });

  it('should navigate images with nextImage and prevImage', () => {
    component.ngOnInit();
    expect(component.currentImageIndex()).toBe(0);

    component.nextImage();
    expect(component.currentImageIndex()).toBe(1);

    component.nextImage();
    expect(component.currentImageIndex()).toBe(2);

    // Should not go beyond last image
    component.nextImage();
    expect(component.currentImageIndex()).toBe(2);

    component.prevImage();
    expect(component.currentImageIndex()).toBe(1);

    component.prevImage();
    expect(component.currentImageIndex()).toBe(0);

    // Should not go below 0
    component.prevImage();
    expect(component.currentImageIndex()).toBe(0);
  });

  it('should return correct current image URL', () => {
    component.ngOnInit();
    expect(component.getCurrentImage()).toBe('img1.jpg');

    component.currentImageIndex.set(1);
    expect(component.getCurrentImage()).toBe('img2.jpg');
  });

  it('should return placeholder when no images', () => {
    listingsServiceMock.getById.mockReturnValue(of({ ...mockListing, images: [] }));
    component.ngOnInit();
    expect(component.getCurrentImage()).toBe('assets/placeholder.png');
  });

  it('should load reviews for the listing', () => {
    const mockReviews = {
      data: [{ _id: 'r1', rating: 5, text: 'Great!', reviewerId: 'u1', sellerId: 's1', productListingId: 'listing-1', status: 'approved' as const, createdAt: new Date(), updatedAt: new Date() }],
      averageRating: 4.5,
      total: 1,
    };
    reviewsServiceMock.getByListing.mockReturnValue(of(mockReviews));
    component.ngOnInit();

    expect(reviewsServiceMock.getByListing).toHaveBeenCalledWith('listing-1');
    expect(component.reviews().length).toBe(1);
    expect(component.averageRating()).toBe(4.5);
    expect(component.totalReviews()).toBe(1);
  });

  it('should load similar listings from same category', () => {
    const similar = [
      { ...mockListing, _id: 'listing-2', title: 'Honda Civic' },
      { ...mockListing, _id: 'listing-3', title: 'Suzuki Alto' },
    ];
    listingsServiceMock.getByCategory.mockReturnValue(of({ data: [...similar, mockListing], total: 3, page: 1, limit: 8 }));
    component.ngOnInit();

    expect(listingsServiceMock.getByCategory).toHaveBeenCalledWith('cat-1', 1, 8);
    expect(component.similarListings().length).toBe(2);
    expect(component.similarListings().find((l: Listing) => l._id === 'listing-1')).toBeUndefined();
  });

  it('should check favorite status on load', () => {
    favoritesServiceMock.check.mockReturnValue(of({ isFavorited: true, favoriteId: 'fav-1' }));
    component.ngOnInit();

    expect(favoritesServiceMock.check).toHaveBeenCalledWith('listing-1');
    expect(component.isFavorited()).toBe(true);
    expect(component.favoriteId()).toBe('fav-1');
  });

  it('should toggle favorite on (add)', () => {
    component.ngOnInit();
    expect(component.isFavorited()).toBe(false);

    component.toggleFavorite();
    expect(favoritesServiceMock.add).toHaveBeenCalledWith('listing-1');
    expect(component.isFavorited()).toBe(true);
    expect(component.favoriteId()).toBe('fav-1');
  });

  it('should toggle favorite off (remove)', () => {
    favoritesServiceMock.check.mockReturnValue(of({ isFavorited: true, favoriteId: 'fav-1' }));
    component.ngOnInit();

    component.toggleFavorite();
    expect(favoritesServiceMock.remove).toHaveBeenCalledWith('fav-1');
    expect(component.isFavorited()).toBe(false);
    expect(component.favoriteId()).toBeNull();
  });

  it('should not toggle favorite when no listing loaded', () => {
    // Don't call ngOnInit, so listing is null
    component.toggleFavorite();
    expect(favoritesServiceMock.add).not.toHaveBeenCalled();
    expect(favoritesServiceMock.remove).not.toHaveBeenCalled();
  });

  it('should generate correct star arrays', () => {
    expect(component.getStarArray(5)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(component.getStarArray(0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
    expect(component.getStarArray(3)).toEqual(['full', 'full', 'full', 'empty', 'empty']);
    expect(component.getStarArray(4.5)).toEqual(['full', 'full', 'full', 'full', 'half']);
  });

  it('should generate review star strings', () => {
    expect(component.getReviewStars(5)).toBe('⭐⭐⭐⭐⭐');
    expect(component.getReviewStars(3)).toBe('⭐⭐⭐☆☆');
    expect(component.getReviewStars(0)).toBe('☆☆☆☆☆');
  });

  it('should build sanitized map URL from listing coordinates', () => {
    component.ngOnInit();
    const url = component.getMapUrl();
    expect(url).toBeTruthy();
    expect(sanitizerMock.bypassSecurityTrustResourceUrl).toHaveBeenCalled();
    const callArg = sanitizerMock.bypassSecurityTrustResourceUrl.mock.calls[0][0];
    expect(callArg).toContain('31.52');
    expect(callArg).toContain('74.35');
    expect(callArg).toContain('maps.google.com');
  });

  it('should return null map URL when listing has no coordinates', () => {
    const noCoordListing = { ...mockListing, location: { ...mockListing.location, coordinates: undefined } };
    listingsServiceMock.getById.mockReturnValue(of(noCoordListing as any));
    component.ngOnInit();
    expect(component.getMapUrl()).toBeNull();
  });

  it('should swipe right to go to next image', () => {
    component.ngOnInit();
    expect(component.currentImageIndex()).toBe(0);

    component.onTouchStart({ changedTouches: [{ screenX: 300 }] } as unknown as TouchEvent);
    component.onTouchEnd({ changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent);
    expect(component.currentImageIndex()).toBe(1);
  });

  it('should swipe left to go to previous image', () => {
    component.ngOnInit();
    component.currentImageIndex.set(1);

    component.onTouchStart({ changedTouches: [{ screenX: 100 }] } as unknown as TouchEvent);
    component.onTouchEnd({ changedTouches: [{ screenX: 300 }] } as unknown as TouchEvent);
    expect(component.currentImageIndex()).toBe(0);
  });

  it('should ignore small swipes below threshold', () => {
    component.ngOnInit();
    expect(component.currentImageIndex()).toBe(0);

    component.onTouchStart({ changedTouches: [{ screenX: 200 }] } as unknown as TouchEvent);
    component.onTouchEnd({ changedTouches: [{ screenX: 180 }] } as unknown as TouchEvent);
    expect(component.currentImageIndex()).toBe(0);
  });

  it('should derive seller trust score from average rating', () => {
    const mockReviews = { data: [], averageRating: 4.2, total: 5 };
    reviewsServiceMock.getByListing.mockReturnValue(of(mockReviews));
    component.ngOnInit();
    expect(component.sellerTrustScore()).toBe(4.2);
  });
});
