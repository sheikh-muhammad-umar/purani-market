import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewsComponent } from './reviews.component';

function makeReview(overrides: Record<string, any> = {}) {
  return {
    _id: 'rv1',
    rating: 4,
    text: 'Solid seller',
    images: [],
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    reviewer: {
      _id: 'u1',
      email: 'buyer@test.com',
      profile: { firstName: 'Bee', lastName: 'Yer' },
    },
    seller: { _id: 'u2', email: 'seller@test.com', averageRating: 4.2, reviewCount: 5 },
    listing: { _id: 'l1', title: 'Widget' },
    ...overrides,
  };
}

describe('ReviewsComponent (admin)', () => {
  let component: ReviewsComponent;
  let http: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = {
      get: vi.fn().mockReturnValue(of({ data: [makeReview()], total: 1 })),
      patch: vi.fn().mockReturnValue(of({})),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    component = new ReviewsComponent(http as any, toast as any);
  });

  it('loads reviews and unwraps {data,total}', () => {
    component.loadReviews();
    expect(component.reviews().length).toBe(1);
    expect(component.total()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('sets an error when loading fails', () => {
    http.get.mockReturnValue(throwError(() => new Error('boom')));
    component.loadReviews();
    expect(component.error()).toBe('Failed to load reviews.');
  });

  it('sends status filter and search as query params', () => {
    component.statusFilter = 'approved';
    component.searchQuery = 'great';
    component.loadReviews();
    const params = http.get.mock.calls[0][1].params;
    expect(params.get('status')).toBe('approved');
    expect(params.get('search')).toBe('great');
  });

  it('resets to page 1 on filter change', () => {
    component.currentPage.set(3);
    component.onFilterChange();
    expect(component.currentPage()).toBe(1);
  });

  it('derives display names from profile then email', () => {
    const r = makeReview();
    expect(component.reviewerName(r as any)).toBe('Bee Yer');
    expect(component.sellerName(r as any)).toBe('seller@test.com');
    expect(component.listingTitle(r as any)).toBe('Widget');
  });

  it('approves a review and reloads', () => {
    component.openDetail(makeReview() as any);
    component.approve();
    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/reviews/admin/rv1/review'), {
      status: 'approved',
    });
    expect(toast.success).toHaveBeenCalled();
    expect(component.selected()).toBeNull();
  });

  it('rejects with an optional note', () => {
    component.openDetail(makeReview() as any);
    component.startReject();
    component.moderationNote = 'Off-topic';
    component.confirmReject();
    expect(http.patch).toHaveBeenCalledWith(expect.any(String), {
      status: 'rejected',
      moderationNote: 'Off-topic',
    });
  });

  it('surfaces an error toast when moderation fails', () => {
    http.patch.mockReturnValue(throwError(() => new Error('fail')));
    component.openDetail(makeReview() as any);
    component.approve();
    expect(toast.error).toHaveBeenCalled();
    expect(component.actionLoading()).toBeNull();
  });

  it('manages the photo lightbox', () => {
    component.openLightbox('http://x/p.png');
    expect(component.lightboxUrl).toBe('http://x/p.png');
    component.closeLightbox();
    expect(component.lightboxUrl).toBeNull();
  });
});
