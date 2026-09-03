import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { SellerReviewsComponent } from './seller-reviews.component';
import { ReviewsService } from '../../../core/services/reviews.service';

function makeReview(overrides: Record<string, any> = {}) {
  return {
    _id: 'rv1',
    reviewerId: { _id: 'u1', profile: { firstName: 'Ali', lastName: 'Khan', avatar: 'a.png' } },
    sellerId: 's1',
    productListingId: 'l1',
    rating: 4,
    text: 'Great seller',
    images: [{ url: 'http://x/p.png', key: 'reviews/p.png' }],
    status: 'approved',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('SellerReviewsComponent', () => {
  let component: SellerReviewsComponent;
  let ref: ComponentRef<SellerReviewsComponent>;
  let fixture: import('@angular/core/testing').ComponentFixture<SellerReviewsComponent>;
  let reviewsService: { getBySeller: ReturnType<typeof vi.fn> };

  function build() {
    TestBed.configureTestingModule({
      imports: [SellerReviewsComponent],
      providers: [{ provide: ReviewsService, useValue: reviewsService }],
    });
    fixture = TestBed.createComponent(SellerReviewsComponent);
    component = fixture.componentInstance;
    ref = fixture.componentRef;
    ref.setInput('sellerId', 's1');
    fixture.detectChanges(); // triggers the effect
  }

  beforeEach(() => {
    reviewsService = {
      getBySeller: vi
        .fn()
        .mockReturnValue(of({ data: [makeReview()], total: 1, averageRating: 4 })),
    };
  });

  it('loads reviews for the seller and populates summary', () => {
    build();
    expect(reviewsService.getBySeller).toHaveBeenCalledWith('s1');
    expect(component.reviews().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.averageRating()).toBe(4);
    expect(component.loading()).toBe(false);
  });

  it('resolves the reviewer name from the populated profile', () => {
    build();
    expect(component.reviewerName(makeReview() as any)).toBe('Ali Khan');
  });

  it('falls back to Anonymous when the reviewer is an id string', () => {
    build();
    expect(component.reviewerName(makeReview({ reviewerId: 'u1' }) as any)).toBe('Anonymous');
  });

  it('exposes the reviewer avatar when present', () => {
    build();
    expect(component.reviewerAvatar(makeReview() as any)).toBe('a.png');
    expect(component.reviewerAvatar(makeReview({ reviewerId: 'u1' }) as any)).toBeNull();
  });

  it('sets an error when the request fails', () => {
    reviewsService.getBySeller.mockReturnValue(throwError(() => new Error('x')));
    build();
    expect(component.error()).toBe('Could not load reviews.');
    expect(component.loading()).toBe(false);
  });

  it('manages the photo lightbox', () => {
    build();
    component.openLightbox('http://x/p.png');
    expect(component.lightboxUrl()).toBe('http://x/p.png');
    component.closeLightbox();
    expect(component.lightboxUrl()).toBeNull();
  });

  it('re-fetches when the sellerId input changes', () => {
    reviewsService.getBySeller.mockReturnValue(of({ data: [], total: 0, averageRating: 0 }));
    build();
    ref.setInput('sellerId', 's2');
    fixture.detectChanges(); // re-runs the effect for the new id
    expect(reviewsService.getBySeller).toHaveBeenCalledWith('s2');
  });
});
