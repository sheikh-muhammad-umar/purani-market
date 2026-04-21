import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ModerationQueueComponent } from './moderation-queue.component';
import {
  AdminService,
  PendingListing,
  PendingListingsResponse,
} from '../../../core/services/admin.service';

const mockListings: PendingListing[] = [
  {
    _id: 'l1',
    title: 'iPhone 14 Pro',
    description: 'Brand new iPhone',
    price: { amount: 250000, currency: 'PKR' },
    categoryId: 'c1',
    categoryName: 'Mobile Phones',
    condition: 'new',
    images: [
      { url: 'https://img.test/1.jpg', thumbnailUrl: 'https://img.test/1_thumb.jpg', sortOrder: 0 },
    ],
    status: 'pending_review',
    sellerId: 's1',
    sellerName: 'Ali Khan',
    sellerEmail: 'ali@example.com',
    createdAt: '2024-06-10T10:00:00Z',
  },
  {
    _id: 'l2',
    title: 'Toyota Corolla 2020',
    description: 'Well maintained car',
    price: { amount: 4500000, currency: 'PKR' },
    categoryId: 'c2',
    categoryName: 'Cars',
    condition: 'used',
    images: [],
    status: 'pending_review',
    sellerId: 's2',
    sellerName: 'Sara Ahmed',
    createdAt: '2024-06-08T08:00:00Z',
  },
];

const mockResponse: PendingListingsResponse = {
  listings: mockListings,
  total: 2,
};

describe('ModerationQueueComponent', () => {
  let component: ModerationQueueComponent;
  let adminService: {
    getPendingListings: ReturnType<typeof vi.fn>;
    approveListing: ReturnType<typeof vi.fn>;
    rejectListing: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    adminService = {
      getPendingListings: vi.fn().mockReturnValue(of(mockResponse)),
      approveListing: vi.fn().mockReturnValue(of(undefined)),
      rejectListing: vi.fn().mockReturnValue(of(undefined)),
    };
    component = new ModerationQueueComponent(adminService as unknown as AdminService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pending listings on init', () => {
    component.ngOnInit();
    expect(adminService.getPendingListings).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.listings().length).toBe(2);
    expect(component.totalListings()).toBe(2);
  });

  it('should sort listings by submission date oldest first', () => {
    component.ngOnInit();
    const listings = component.listings();
    expect(listings[0]._id).toBe('l2'); // 2024-06-08 is older
    expect(listings[1]._id).toBe('l1'); // 2024-06-10 is newer
  });

  it('should handle load error', () => {
    adminService.getPendingListings.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load pending listings. Please try again.');
  });

  it('should approve a listing and remove it from the list', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    component.approveListing(listing);
    expect(adminService.approveListing).toHaveBeenCalledWith('l1');
    expect(component.listings().find((l) => l._id === 'l1')).toBeUndefined();
    expect(component.totalListings()).toBe(1);
    expect(component.actionLoading()).toBeNull();
  });

  it('should handle approve error', () => {
    adminService.approveListing.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    component.approveListing(listing);
    expect(component.actionLoading()).toBeNull();
    expect(component.listings().length).toBe(2); // unchanged
  });

  it('should start reject flow', () => {
    component.ngOnInit();
    const listing = component.listings()[0];
    component.startReject(listing);
    expect(component.rejectingId).toBe(listing._id);
  });

  it('should cancel reject flow', () => {
    component.ngOnInit();
    const listing = component.listings()[0];
    component.startReject(listing);
    component.cancelReject();
    expect(component.rejectingId).toBeNull();
  });

  it('should not confirm reject without a reason', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    component.startReject(listing);
    component.rejectionReasons['l1'] = '   ';
    component.confirmReject(listing);
    expect(adminService.rejectListing).not.toHaveBeenCalled();
  });

  it('should confirm reject with a reason and remove listing', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    component.startReject(listing);
    component.rejectionReasons['l1'] = 'Inappropriate content';
    component.confirmReject(listing);
    expect(adminService.rejectListing).toHaveBeenCalledWith('l1', 'Inappropriate content');
    expect(component.listings().find((l) => l._id === 'l1')).toBeUndefined();
    expect(component.totalListings()).toBe(1);
    expect(component.rejectingId).toBeNull();
    expect(component.actionLoading()).toBeNull();
  });

  it('should handle reject error', () => {
    adminService.rejectListing.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    component.rejectionReasons['l1'] = 'Bad content';
    component.confirmReject(listing);
    expect(component.actionLoading()).toBeNull();
    expect(component.listings().length).toBe(2); // unchanged
  });

  it('should get thumbnail from first image', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    expect(component.getThumbnail(listing)).toBe('https://img.test/1_thumb.jpg');
  });

  it('should return empty string when no images', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l2')!;
    expect(component.getThumbnail(listing)).toBe('');
  });

  it('should fall back to url when thumbnailUrl is empty', () => {
    const listing: PendingListing = {
      ...mockListings[0],
      images: [{ url: 'https://img.test/full.jpg', thumbnailUrl: '', sortOrder: 0 }],
    };
    expect(component.getThumbnail(listing)).toBe('https://img.test/full.jpg');
  });

  it('should format date', () => {
    const result = component.formatDate('2024-06-10T10:00:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });

  it('should return dash for empty date', () => {
    expect(component.formatDate('')).toBe('—');
  });

  it('should format price', () => {
    component.ngOnInit();
    const listing = component.listings().find((l) => l._id === 'l1')!;
    const price = component.formatPrice(listing);
    expect(price).toContain('PKR');
    expect(price).toContain('250');
  });

  it('should return dash for missing price', () => {
    const listing = { ...mockListings[0], price: undefined } as any;
    expect(component.formatPrice(listing)).toBe('—');
  });
});
