import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { WriteReviewComponent } from './write-review.component';
import { ReviewsService } from '../../../core/services/reviews.service';

describe('WriteReviewComponent', () => {
  let component: WriteReviewComponent;
  let reviewsService: {
    submit: ReturnType<typeof vi.fn>;
  };
  let route: { snapshot: { queryParams: Record<string, string> } };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reviewsService = {
      submit: vi.fn().mockReturnValue(of({ _id: 'rev1' })),
    };
    route = { snapshot: { queryParams: { listingId: 'listing1' } } };
    router = { navigate: vi.fn() };

    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read listingId from query params on init', () => {
    component.ngOnInit();
    expect(component.productListingId()).toBe('listing1');
  });

  it('should set productListingId to null when not provided', () => {
    route.snapshot.queryParams = {};
    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
    );
    component.ngOnInit();
    expect(component.productListingId()).toBeNull();
  });

  it('should not be valid initially', () => {
    component.ngOnInit();
    expect(component.isValid).toBe(false);
  });

  it('should be valid with rating, text, and listingId', () => {
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Great product!');
    expect(component.isValid).toBe(true);
  });

  it('should not be valid without rating', () => {
    component.ngOnInit();
    component.onTextChange('Great product!');
    expect(component.isValid).toBe(false);
  });

  it('should not be valid with empty text', () => {
    component.ngOnInit();
    component.setRating(4);
    expect(component.isValid).toBe(false);
  });

  it('should not be valid with whitespace-only text', () => {
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('   ');
    expect(component.isValid).toBe(false);
  });

  it('should not be valid without listingId', () => {
    route.snapshot.queryParams = {};
    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
    );
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Great product!');
    expect(component.isValid).toBe(false);
  });

  it('should set and clear hover rating', () => {
    component.setHover(3);
    expect(component.hoverRating()).toBe(3);
    component.clearHover();
    expect(component.hoverRating()).toBe(0);
  });

  it('should determine filled stars based on hover', () => {
    component.setRating(2);
    component.setHover(4);
    expect(component.isStarFilled(3)).toBe(true);
    expect(component.isStarFilled(5)).toBe(false);
  });

  it('should determine filled stars based on rating when no hover', () => {
    component.setRating(3);
    expect(component.isStarFilled(3)).toBe(true);
    expect(component.isStarFilled(4)).toBe(false);
  });

  it('should truncate text at max length', () => {
    component.ngOnInit();
    const longText = 'a'.repeat(2100);
    component.onTextChange(longText);
    expect(component.text().length).toBe(2000);
  });

  it('should track text length', () => {
    component.onTextChange('Hello');
    expect(component.textLength).toBe(5);
  });

  it('should submit review successfully', () => {
    component.ngOnInit();
    component.setRating(5);
    component.onTextChange('Excellent product!');
    component.submit();

    expect(reviewsService.submit).toHaveBeenCalledWith({
      productListingId: 'listing1',
      rating: 5,
      text: 'Excellent product!',
    });
    expect(component.success()).toBe(true);
    expect(component.submitting()).toBe(false);
  });

  it('should handle submit error', () => {
    reviewsService.submit.mockReturnValue(throwError(() => ({
      error: { message: 'You must have a conversation first' },
    })));
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Good product');
    component.submit();

    expect(component.error()).toBe('You must have a conversation first');
    expect(component.success()).toBe(false);
    expect(component.submitting()).toBe(false);
  });

  it('should show generic error when no message in error response', () => {
    reviewsService.submit.mockReturnValue(throwError(() => new Error('network')));
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Good product');
    component.submit();

    expect(component.error()).toBe('Failed to submit review. Please try again.');
    expect(component.submitting()).toBe(false);
  });

  it('should not submit when invalid', () => {
    component.ngOnInit();
    component.submit();
    expect(reviewsService.submit).not.toHaveBeenCalled();
  });

  it('should not submit when already submitting', () => {
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Good product');

    // Simulate submitting state
    reviewsService.submit.mockReturnValue(of({ _id: 'rev1' }));
    component.submit();
    reviewsService.submit.mockClear();

    // Reset to allow re-submit attempt while success is true
    // The guard is submitting() which is false after first submit
    // So test the submitting guard directly
    component['submitting'].set(true);
    component.submit();
    expect(reviewsService.submit).not.toHaveBeenCalled();
  });

  it('should trim text before submitting', () => {
    component.ngOnInit();
    component.setRating(3);
    component.onTextChange('  Some review text  ');
    component.submit();

    expect(reviewsService.submit).toHaveBeenCalledWith({
      productListingId: 'listing1',
      rating: 3,
      text: 'Some review text',
    });
  });
});
