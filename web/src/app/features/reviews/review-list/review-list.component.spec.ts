import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ReviewListComponent } from './review-list.component';
import { ReviewsService } from '../../../core/services/reviews.service';
import { Review } from '../../../core/models';

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    _id: overrides._id ?? 'rev1',
    reviewerId: overrides.reviewerId ?? 'user1',
    sellerId: overrides.sellerId ?? 'seller1',
    productListingId: overrides.productListingId ?? 'listing1',
    rating: overrides.rating ?? 4,
    text: overrides.text ?? 'Great product!',
    status: overrides.status ?? 'approved',
    createdAt: overrides.createdAt ?? new Date('2024-06-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-06-01'),
  };
}

describe('ReviewListComponent', () => {
  let component: ReviewListComponent;
  let reviewsService: {
    getByListing: ReturnType<typeof vi.fn>;
    getBySeller: ReturnType<typeof vi.fn>;
  };
  let route: { snapshot: { queryParams: Record<string, string> } };

  const mockReviews: Review[] = [
    makeReview({ _id: 'r1', rating: 5, text: 'Excellent!' }),
    makeReview({ _id: 'r2', rating: 3, text: 'Average product' }),
    makeReview({ _id: 'r3', rating: 4, text: 'Good value' }),
  ];

  const mockResponse = { data: mockReviews, total: 3, averageRating: 4.0 };

  beforeEach(() => {
    reviewsService = {
      getByListing: vi.fn().mockReturnValue(of(mockResponse)),
      getBySeller: vi.fn().mockReturnValue(of(mockResponse)),
    };
    route = { snapshot: { queryParams: { listingId: 'listing1' } } };

    component = new ReviewListComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load reviews by listing on init', () => {
    component.ngOnInit();
    expect(reviewsService.getByListing).toHaveBeenCalledWith('listing1');
    expect(component.reviews().length).toBe(3);
    expect(component.averageRating()).toBe(4.0);
    expect(component.totalReviews()).toBe(3);
    expect(component.loading()).toBe(false);
  });

  it('should load reviews by seller when sellerId is provided', () => {
    route.snapshot.queryParams = { sellerId: 'seller1' };
    component = new ReviewListComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
    );
    component.ngOnInit();
    expect(reviewsService.getBySeller).toHaveBeenCalledWith('seller1');
    expect(component.reviews().length).toBe(3);
  });

  it('should prefer listingId over sellerId', () => {
    route.snapshot.queryParams = { listingId: 'l1', sellerId: 's1' };
    component = new ReviewListComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
    );
    component.ngOnInit();
    expect(reviewsService.getByListing).toHaveBeenCalledWith('l1');
    expect(reviewsService.getBySeller).not.toHaveBeenCalled();
  });

  it('should show error when no listingId or sellerId', () => {
    route.snapshot.queryParams = {};
    component = new ReviewListComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
    );
    component.ngOnInit();
    expect(component.error()).toBe('No listing or seller specified.');
    expect(component.loading()).toBe(false);
  });

  it('should handle load error', () => {
    reviewsService.getByListing.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).toBe('Failed to load reviews. Please try again.');
    expect(component.loading()).toBe(false);
  });

  it('should return 5 stars from getStars', () => {
    expect(component.getStars(3)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should format date correctly', () => {
    const formatted = component.formatDate(new Date('2024-06-01'));
    expect(formatted).toContain('Jun');
    expect(formatted).toContain('2024');
  });

  it('should return correct page title for listing', () => {
    component.ngOnInit();
    expect(component.getPageTitle()).toBe('Listing Reviews');
  });

  it('should return correct page title for seller', () => {
    route.snapshot.queryParams = { sellerId: 'seller1' };
    component = new ReviewListComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
    );
    component.ngOnInit();
    expect(component.getPageTitle()).toBe('Seller Reviews');
  });

  it('should show empty state when no reviews', () => {
    reviewsService.getByListing.mockReturnValue(of({ data: [], total: 0, averageRating: 0 }));
    component.ngOnInit();
    expect(component.reviews().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should retry loading on loadReviews call', () => {
    reviewsService.getByListing.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).not.toBeNull();

    reviewsService.getByListing.mockReturnValue(of(mockResponse));
    component.loadReviews();
    expect(component.error()).toBeNull();
    expect(component.reviews().length).toBe(3);
  });
});
