import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { WriteReviewComponent } from './write-review.component';
import { ReviewsService } from '../../../core/services/reviews.service';
import { ToastService } from '../../../core/services/toast.service';

describe('WriteReviewComponent', () => {
  let component: WriteReviewComponent;
  let reviewsService: {
    submit: ReturnType<typeof vi.fn>;
  };
  let route: { snapshot: { queryParams: Record<string, string> } };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reviewsService = {
      submit: vi.fn().mockReturnValue(of({ _id: 'rev1' })),
    };
    route = { snapshot: { queryParams: { sellerId: 'seller1' } } };
    router = { navigate: vi.fn() };
    toastMock = { success: vi.fn(), error: vi.fn() };

    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
      toastMock as unknown as ToastService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read sellerId from query params on init', () => {
    component.ngOnInit();
    expect(component.sellerId()).toBe('seller1');
  });

  it('should read optional listingId context from query params', () => {
    route.snapshot.queryParams = { sellerId: 'seller1', listingId: 'listing1' };
    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
      toastMock as unknown as ToastService,
    );
    component.ngOnInit();
    expect(component.productListingId()).toBe('listing1');
  });

  it('should set sellerId to null when not provided', () => {
    route.snapshot.queryParams = {};
    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
      toastMock as unknown as ToastService,
    );
    component.ngOnInit();
    expect(component.sellerId()).toBeNull();
  });

  it('should not be valid initially', () => {
    component.ngOnInit();
    expect(component.isValid).toBe(false);
  });

  it('should be valid with rating, text, and sellerId', () => {
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

  it('should not be valid without sellerId', () => {
    route.snapshot.queryParams = {};
    component = new WriteReviewComponent(
      reviewsService as unknown as ReviewsService,
      route as any,
      router as any,
      toastMock as unknown as ToastService,
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
      sellerId: 'seller1',
      productListingId: undefined,
      rating: 5,
      text: 'Excellent product!',
      images: [],
    });
    expect(component.success()).toBe(true);
    expect(component.submitting()).toBe(false);
  });

  it('should handle submit error', () => {
    reviewsService.submit.mockReturnValue(
      throwError(() => ({
        error: { message: 'You must have a conversation first' },
      })),
    );
    component.ngOnInit();
    component.setRating(4);
    component.onTextChange('Good product');
    component.submit();

    expect(component.error()).toBe('Failed to submit review. Please try again.');
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
      sellerId: 'seller1',
      productListingId: undefined,
      rating: 3,
      text: 'Some review text',
      images: [],
    });
  });

  // ── Image upload ────────────────────────────────────────────

  it('adds a valid image to the previews', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    // Fake FileReader whose onload fires synchronously when readAsDataURL runs.
    class FakeFileReader {
      onload: (() => void) | null = null;
      result = 'data:img';
      readAsDataURL(): void {
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);
    component.onFilesSelected({ target: { files: [file], value: '' } } as any);
    expect(component.previews().length).toBe(1);
    vi.unstubAllGlobals();
  });

  it('rejects a disallowed image type', () => {
    const file = new File(['x'], 'a.gif', { type: 'image/gif' });
    component.onFilesSelected({ target: { files: [file], value: '' } } as any);
    expect(component.error()).toContain('JPEG');
    expect(component.previews().length).toBe(0);
  });

  it('caps the number of images at the maximum', () => {
    component.previews.set([
      { file: {} as File, url: 'a' },
      { file: {} as File, url: 'b' },
    ]);
    const file = new File(['x'], 'c.png', { type: 'image/png' });
    component.onFilesSelected({ target: { files: [file], value: '' } } as any);
    expect(component.error()).toContain('up to');
    expect(component.previews().length).toBe(2);
  });

  it('removes an image by index', () => {
    component.previews.set([
      { file: {} as File, url: 'a' },
      { file: {} as File, url: 'b' },
    ]);
    component.removeImage(0);
    expect(component.previews().map((p) => p.url)).toEqual(['b']);
  });

  it('submits the selected image files', () => {
    component.ngOnInit();
    component.setRating(5);
    component.onTextChange('Great with photos');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    component.previews.set([{ file, url: 'data:img' }]);
    component.submit();
    expect(reviewsService.submit).toHaveBeenCalledWith(expect.objectContaining({ images: [file] }));
  });
});
