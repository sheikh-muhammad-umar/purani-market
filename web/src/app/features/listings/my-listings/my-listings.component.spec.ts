import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MyListingsComponent } from './my-listings.component';
import { ListingsService } from '../../../core/services/listings.service';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { Listing, User, PackagePurchase } from '../../../core/models';

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    _id: overrides._id ?? 'l1',
    sellerId: 's1',
    title: overrides.title ?? 'Test Item',
    description: 'desc',
    price: overrides.price ?? { amount: 1000, currency: 'PKR' },
    categoryId: 'c1',
    categoryPath: ['c1'],
    condition: 'used',
    categoryAttributes: {},
    images: overrides.images ?? [{ url: 'img.jpg', thumbnailUrl: 'thumb.jpg', sortOrder: 0 }],
    video: undefined,
    location: { type: 'Point', coordinates: [74, 31], city: 'Lahore', area: 'DHA' },
    contactInfo: { phone: '0300', email: 'a@b.com' },
    status: overrides.status ?? 'active',
    isFeatured: overrides.isFeatured ?? false,
    featuredUntil: overrides.featuredUntil,
    viewCount: overrides.viewCount ?? 10,
    favoriteCount: overrides.favoriteCount ?? 5,
    createdAt: overrides.createdAt ?? new Date('2024-01-15'),
    updatedAt: new Date(),
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    _id: 'u1',
    email: 'seller@test.com',
    role: 'seller',
    profile: {
      firstName: 'Test',
      lastName: 'Seller',
      avatar: '',
      location: { type: 'Point', coordinates: [0, 0] },
      city: 'Lahore',
      postalCode: '54000',
    },
    emailVerified: true,
    phoneVerified: false,
    socialLogins: [],
    mfa: { enabled: false, failedAttempts: 0 },
    notificationPreferences: {
      messages: true,
      offers: true,
      productUpdates: true,
      promotions: true,
      packageAlerts: true,
    },
    deviceTokens: [],
    adLimit: overrides.adLimit ?? 10,
    activeAdCount: overrides.activeAdCount ?? 3,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePurchase(overrides: Partial<PackagePurchase> = {}): PackagePurchase {
  return {
    _id: overrides._id ?? 'p1',
    sellerId: 's1',
    packageId: 'pkg1',
    type: overrides.type ?? 'ad_slots',
    quantity: overrides.quantity ?? 10,
    remainingQuantity: overrides.remainingQuantity ?? 5,
    duration: 30,
    price: 1000,
    paymentMethod: 'card',
    paymentStatus: overrides.paymentStatus ?? 'completed',
    paymentTransactionId: 'tx1',
    activatedAt: new Date(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('MyListingsComponent', () => {
  let component: MyListingsComponent;
  let listingsService: {
    getMyListings: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    featureListing: ReturnType<typeof vi.fn>;
    deleteListing: ReturnType<typeof vi.fn>;
  };
  let packagesService: { getMyPurchases: ReturnType<typeof vi.fn> };
  let authService: { fetchCurrentUser: ReturnType<typeof vi.fn> };
  let trackerMock: { track: ReturnType<typeof vi.fn> };
  let confirmModalMock: { confirmPackageWarning: ReturnType<typeof vi.fn> };

  const mockListings: Listing[] = [
    makeListing({ _id: 'l1', title: 'Car', viewCount: 100, favoriteCount: 20, status: 'active' }),
    makeListing({ _id: 'l2', title: 'Phone', viewCount: 50, favoriteCount: 10, status: 'sold' }),
    makeListing({
      _id: 'l3',
      title: 'Featured Laptop',
      viewCount: 200,
      favoriteCount: 30,
      status: 'active',
      isFeatured: true,
      featuredUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    }),
  ];

  beforeEach(() => {
    listingsService = {
      getMyListings: vi
        .fn()
        .mockReturnValue(of({ data: mockListings, total: 3, page: 1, limit: 50 })),
      updateStatus: vi.fn().mockReturnValue(of({})),
      featureListing: vi.fn().mockReturnValue(of({})),
      deleteListing: vi.fn().mockReturnValue(of(undefined)),
    };
    packagesService = {
      getMyPurchases: vi.fn().mockReturnValue(of({ data: [makePurchase()], total: 1 })),
    };
    authService = {
      fetchCurrentUser: vi.fn().mockReturnValue(of(makeUser())),
    };

    trackerMock = {
      track: vi.fn(),
    };

    confirmModalMock = {
      confirmPackageWarning: vi.fn().mockResolvedValue(true),
    };

    component = new MyListingsComponent(
      listingsService as unknown as ListingsService,
      packagesService as unknown as PackagesService,
      authService as unknown as AuthService,
      trackerMock as unknown as ActivityTrackerService,
      confirmModalMock as unknown as ConfirmModalService,
    );
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load listings on init', () => {
    expect(listingsService.getMyListings).toHaveBeenCalledWith(1, 50);
    expect(component.listings().length).toBe(3);
    expect(component.total()).toBe(3);
    expect(component.loading()).toBe(false);
  });

  it('should compute analytics cards', () => {
    const cards = component.analytics();
    expect(cards.length).toBe(3);
    expect(cards[0].label).toBe('Total Views');
    expect(cards[0].value).toBe(350); // 100 + 50 + 200
    expect(cards[1].label).toBe('Total Favorites');
    expect(cards[1].value).toBe(60); // 20 + 10 + 30
    expect(cards[2].label).toBe('Active Listings');
    expect(cards[2].value).toBe(2); // Car + Featured Laptop
  });

  it('should compute ad slots meter from user data', () => {
    expect(component.freeSlotLimit()).toBe(10);
    expect(component.activeAdCount()).toBe(3);
    expect(component.slotsUsed()).toBe(3);
  });

  it('should compute paid slots from active purchases', () => {
    expect(component.paidSlots()).toBe(5);
    expect(component.totalSlots()).toBe(15); // 10 free + 5 paid
  });

  it('should compute slot percentage', () => {
    // 3 used / 15 total = 20%
    expect(component.slotPercent()).toBe(20);
  });

  it('should compute featured ads info', () => {
    const featured = component.featuredAds();
    expect(featured.length).toBe(1);
    expect(featured[0].title).toBe('Featured Laptop');
  });

  it('should compute featured slots remaining from purchases', () => {
    packagesService.getMyPurchases.mockReturnValue(
      of({
        data: [makePurchase({ type: 'featured_ads', remainingQuantity: 3 })],
        total: 1,
      }),
    );
    component.ngOnInit();
    expect(component.featuredSlotsRemaining()).toBe(3);
  });

  it('should exclude expired purchases from paid slots', () => {
    packagesService.getMyPurchases.mockReturnValue(
      of({
        data: [makePurchase({ expiresAt: new Date(Date.now() - 1000) })],
        total: 1,
      }),
    );
    component.ngOnInit();
    expect(component.paidSlots()).toBe(0);
  });

  // --- Status badge ---
  it('should return correct badge class for each status', () => {
    expect(component.getStatusBadgeClass('active')).toBe('badge-success');
    expect(component.getStatusBadgeClass('sold')).toBe('badge-sold');
    expect(component.getStatusBadgeClass('reserved')).toBe('badge-warning');
    expect(component.getStatusBadgeClass('rejected')).toBe('badge-error');
    expect(component.getStatusBadgeClass('pending_review')).toBe('badge-pending');
    expect(component.getStatusBadgeClass('unknown')).toBe('');
  });

  // --- Image helper ---
  it('should return thumbnail url', () => {
    const listing = makeListing({
      images: [{ url: 'full.jpg', thumbnailUrl: 'thumb.jpg', sortOrder: 0 }],
    });
    expect(component.getImage(listing)).toBe('thumb.jpg');
  });

  it('should fallback to url when no thumbnail', () => {
    const listing = makeListing({ images: [{ url: 'full.jpg', thumbnailUrl: '', sortOrder: 0 }] });
    expect(component.getImage(listing)).toBe('full.jpg');
  });

  it('should fallback to placeholder when no images', () => {
    const listing = makeListing({ images: [] });
    expect(component.getImage(listing)).toBe('assets/placeholder.png');
  });

  // --- Mark status ---
  it('should call updateStatus and reload on mark sold', () => {
    const listing = mockListings[0];
    component.markStatus(listing, 'sold');
    expect(listingsService.updateStatus).toHaveBeenCalledWith('l1', 'sold');
  });

  it('should call updateStatus for reserved', () => {
    const listing = mockListings[0];
    component.markStatus(listing, 'reserved');
    expect(listingsService.updateStatus).toHaveBeenCalledWith('l1', 'reserved');
  });

  // --- Feature listing ---
  it('should call featureListing and reload', () => {
    const listing = mockListings[0];
    component.featureListing(listing);
    expect(listingsService.featureListing).toHaveBeenCalledWith('l1');
  });

  // --- Delete listing ---
  it('should set confirmDeleteId on confirmDelete', () => {
    component.confirmDelete('l1');
    expect(component.confirmDeleteId()).toBe('l1');
  });

  it('should clear confirmDeleteId on cancelDelete', () => {
    component.confirmDelete('l1');
    component.cancelDelete();
    expect(component.confirmDeleteId()).toBeNull();
  });

  it('should call deleteListing and reload', () => {
    component.deleteListing('l1');
    expect(listingsService.deleteListing).toHaveBeenCalledWith('l1');
  });

  // --- Error handling ---
  it('should handle listings load error', () => {
    listingsService.getMyListings.mockReturnValue(throwError(() => new Error('fail')));
    component.loadListings();
    expect(component.listings().length).toBe(0);
    expect(component.loading()).toBe(false);
  });

  it('should handle purchases load error', () => {
    packagesService.getMyPurchases.mockReturnValue(throwError(() => new Error('fail')));
    component.loadPurchases();
    expect(component.purchases().length).toBe(0);
  });

  // --- Date helpers ---
  it('should format date correctly', () => {
    const formatted = component.formatDate('2024-01-15');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
  });

  it('should compute days until a future date', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(component.daysUntil(future)).toBe(5);
  });

  it('should return 0 for past dates', () => {
    const past = new Date(Date.now() - 1000);
    expect(component.daysUntil(past)).toBe(0);
  });

  // --- Action loading state ---
  it('should set actionLoading during markStatus', () => {
    // updateStatus returns synchronously in mock, so loading resets immediately
    component.markStatus(mockListings[0], 'sold');
    // After subscribe completes, actionLoading should be null
    expect(component.actionLoading()).toBeNull();
  });

  it('should handle markStatus error', () => {
    listingsService.updateStatus.mockReturnValue(throwError(() => new Error('fail')));
    component.markStatus(mockListings[0], 'sold');
    expect(component.actionLoading()).toBeNull();
  });

  it('should handle featureListing error', () => {
    listingsService.featureListing.mockReturnValue(throwError(() => new Error('fail')));
    component.featureListing(mockListings[0]);
    expect(component.actionLoading()).toBeNull();
  });

  it('should handle deleteListing error', () => {
    listingsService.deleteListing.mockReturnValue(throwError(() => new Error('fail')));
    component.deleteListing('l1');
    expect(component.actionLoading()).toBeNull();
  });
});
