import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MyPackagesComponent } from './my-packages.component';
import { PackagesService } from '../../../core/services/packages.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { daysToMs } from '../../../core/utils/time';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { PackagePurchase } from '../../../core/models';

function makePurchase(overrides: Partial<PackagePurchase> = {}): PackagePurchase {
  return {
    _id: overrides._id ?? 'pur1',
    sellerId: overrides.sellerId ?? 'seller1',
    packageId: overrides.packageId ?? 'pkg1',
    categoryId: overrides.categoryId,
    type: overrides.type ?? 'featured_ads',
    quantity: overrides.quantity ?? 5,
    remainingQuantity: overrides.remainingQuantity ?? 3,
    entitlements: overrides.entitlements,
    duration: overrides.duration ?? 7,
    price: overrides.price ?? 500,
    paymentMethod: overrides.paymentMethod ?? 'jazzcash',
    paymentStatus: overrides.paymentStatus ?? 'completed',
    paymentTransactionId: overrides.paymentTransactionId ?? 'txn1',
    activatedAt: overrides.activatedAt ?? new Date('2024-06-01'),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + daysToMs(5)),
    createdAt: overrides.createdAt ?? new Date('2024-06-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-06-01'),
  };
}

describe('MyPackagesComponent', () => {
  let component: MyPackagesComponent;
  let packagesService: { getMyPurchases: ReturnType<typeof vi.fn> };
  let categoriesService: { getAll: ReturnType<typeof vi.fn> };
  let tracker: { track: ReturnType<typeof vi.fn> };

  const activePurchase = makePurchase({ _id: 'active1', remainingQuantity: 3 });
  const expiredPurchase = makePurchase({
    _id: 'expired1',
    remainingQuantity: 0,
    expiresAt: new Date('2024-01-01'),
    paymentStatus: 'completed',
  });
  const failedPurchase = makePurchase({
    _id: 'failed1',
    paymentStatus: 'failed',
    remainingQuantity: 5,
  });

  const mockPurchases: PackagePurchase[] = [activePurchase, expiredPurchase, failedPurchase];

  beforeEach(() => {
    packagesService = {
      getMyPurchases: vi.fn().mockReturnValue(of({ data: mockPurchases, total: 3 })),
    };
    categoriesService = {
      getAll: vi.fn().mockReturnValue(of([{ _id: 'cat1', name: 'Electronics' }])),
    };
    tracker = {
      track: vi.fn(),
    };
    const routeMock = { snapshot: { queryParams: {} } };
    const shortsServiceMock = { getMyPurchases: vi.fn().mockReturnValue(of([])) };
    component = new MyPackagesComponent(
      packagesService as unknown as PackagesService,
      shortsServiceMock as any,
      categoriesService as unknown as CategoriesService,
      tracker as unknown as ActivityTrackerService,
      routeMock as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load purchases on init', () => {
    component.ngOnInit();
    expect(packagesService.getMyPurchases).toHaveBeenCalled();
    expect(component.purchases().length).toBe(3);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should load categories on init', () => {
    component.ngOnInit();
    expect(categoriesService.getAll).toHaveBeenCalled();
    expect(component.categories().length).toBe(1);
  });

  it('should fire MY_PACKAGES_VIEWED event on load', () => {
    component.ngOnInit();
    expect(tracker.track).toHaveBeenCalledWith('my_packages_viewed', {
      metadata: { categoryId: 'all' },
    });
  });

  it('should handle load error', () => {
    packagesService.getMyPurchases.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load your packages. Please try again.');
  });

  it('should filter active purchases', () => {
    component.ngOnInit();
    const active = component.activePurchases();
    expect(active.length).toBe(1);
    expect(active[0]._id).toBe('active1');
  });

  it('should filter history purchases', () => {
    component.ngOnInit();
    const history = component.historyPurchases();
    expect(history.length).toBe(2);
    expect(history.map((h) => h._id)).toContain('expired1');
    expect(history.map((h) => h._id)).toContain('failed1');
  });

  it('should switch tabs', () => {
    expect(component.activeTab()).toBe('active');
    component.setTab('history');
    expect(component.activeTab()).toBe('history');
    component.setTab('active');
    expect(component.activeTab()).toBe('active');
  });

  it('should pass categoryId to getMyPurchases when filter is set', () => {
    component.onCategoryFilterChange('cat1');
    expect(packagesService.getMyPurchases).toHaveBeenCalledWith('cat1');
  });

  it('should fire MY_PACKAGES_FILTER_CHANGED event on filter change', () => {
    component.onCategoryFilterChange('cat1');
    expect(tracker.track).toHaveBeenCalledWith('my_packages_filter_changed', {
      metadata: { categoryId: 'cat1', resultCount: 3 },
    });
  });

  it('should fire MY_PACKAGES_VIEWED with "all" when no filter', () => {
    component.ngOnInit();
    expect(tracker.track).toHaveBeenCalledWith('my_packages_viewed', {
      metadata: { categoryId: 'all' },
    });
  });

  it('should fire MY_PACKAGES_FILTER_CHANGED with "all" when filter cleared', () => {
    component.onCategoryFilterChange('');
    expect(tracker.track).toHaveBeenCalledWith('my_packages_filter_changed', {
      metadata: { categoryId: 'all', resultCount: 3 },
    });
  });

  it('should return correct status badge classes', () => {
    expect(component.getStatusBadgeClass('completed')).toBe('badge-success');
    expect(component.getStatusBadgeClass('pending')).toBe('badge-pending');
    expect(component.getStatusBadgeClass('failed')).toBe('badge-error');
    expect(component.getStatusBadgeClass('refunded')).toBe('badge-warning');
  });

  it('should return correct type labels', () => {
    expect(component.getTypeLabel('featured_ads')).toBe('Featured Ads');
    expect(component.getTypeLabel('ad_slots')).toBe('Ad Slots');
  });

  it('labels an all-in-one purchase as such', () => {
    // Regression: the ternary this replaced returned 'Ad Slots' for anything that
    // was not featured ads, so every bundle purchase was mislabelled.
    expect(component.getTypeLabel('bundle')).toBe('All in One');
  });

  it('should format price correctly', () => {
    expect(component.formatPrice(500)).toBe('Rs 500');
  });

  it('should format date correctly', () => {
    const formatted = component.formatDate(new Date('2024-06-15'));
    expect(formatted).toContain('2024');
    expect(formatted).toContain('Jun');
  });

  it('should return dash for undefined date', () => {
    expect(component.formatDate(undefined)).toBe('—');
  });

  it('should calculate remaining days', () => {
    const futureDate = new Date(Date.now() + daysToMs(5));
    const days = component.getRemainingDays(futureDate);
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it('should return 0 for past expiration', () => {
    expect(component.getRemainingDays(new Date('2020-01-01'))).toBe(0);
  });

  it('should return 0 for undefined expiration', () => {
    expect(component.getRemainingDays(undefined)).toBe(0);
  });

  it('should return correct payment method labels', () => {
    expect(component.getPaymentMethodLabel('jazzcash')).toBe('JazzCash');
    expect(component.getPaymentMethodLabel('easypaisa')).toBe('EasyPaisa');
    expect(component.getPaymentMethodLabel('card')).toBe('Credit/Debit Card');
    expect(component.getPaymentMethodLabel('other')).toBe('other');
  });

  it('should retry loading on loadPurchases call', () => {
    packagesService.getMyPurchases.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).not.toBeNull();

    packagesService.getMyPurchases.mockReturnValue(of({ data: mockPurchases, total: 3 }));
    component.loadPurchases();
    expect(component.error()).toBeNull();
    expect(component.purchases().length).toBe(3);
  });

  it('should show empty state when no active packages', () => {
    packagesService.getMyPurchases.mockReturnValue(
      of({ data: [expiredPurchase, failedPurchase], total: 2 }),
    );
    component.ngOnInit();
    expect(component.activePurchases().length).toBe(0);
  });

  describe('all-in-one purchases', () => {
    /**
     * An all-in-one purchase tracks a balance per kind and never decrements
     * `remainingQuantity`, so these fixtures leave it at the purchased total —
     * which is exactly what the database holds.
     */
    const makeBundle = (id: string, remaining: [number, number, number]) =>
      makePurchase({
        _id: id,
        type: 'bundle',
        quantity: 18,
        remainingQuantity: 18,
        entitlements: [
          { kind: 'featured_ads', quantity: 3, remaining: remaining[0] },
          { kind: 'ad_slots', quantity: 10, remaining: remaining[1] },
          { kind: 'shorts', quantity: 5, remaining: remaining[2] },
        ],
      });

    const partlyUsed = makeBundle('bundle-part', [1, 4, 2]);
    const spentOut = makeBundle('bundle-spent', [0, 0, 0]);

    beforeEach(() => {
      packagesService.getMyPurchases.mockReturnValue(
        of({ data: [activePurchase, partlyUsed, spentOut], total: 3 }),
      );
      component.ngOnInit();
    });

    it('keeps all-in-one purchases off the ad packages tab', () => {
      expect(component.adsPurchases().map((p) => p._id)).toEqual(['active1']);
      expect(component.activePurchases().map((p) => p._id)).toEqual(['active1']);
    });

    it('lists all-in-one purchases on their own tab', () => {
      expect(component.bundlePurchases().map((p) => p._id)).toEqual([
        'bundle-part',
        'bundle-spent',
      ]);
    });

    it('keeps a part-used all-in-one active', () => {
      expect(component.activeBundles().map((p) => p._id)).toEqual(['bundle-part']);
    });

    it('moves a fully-spent all-in-one to history', () => {
      // Regression: this was classified on `remainingQuantity`, which a bundle never
      // decrements, so a spent-out package stayed under Active until it expired.
      expect(component.historyBundles().map((p) => p._id)).toEqual(['bundle-spent']);
    });

    it('reports the balance of each kind separately', () => {
      expect(
        component.entitlementBalances(partlyUsed).map((e) => [e.label, e.remaining, e.quantity]),
      ).toEqual([
        ['Featured ads', 1, 3],
        ['Ad slots', 4, 10],
        ['Shorts', 2, 5],
      ]);
    });

    it('has no balances to report for a single-purpose purchase', () => {
      expect(component.entitlementBalances(activePurchase)).toEqual([]);
    });

    it('opens on the all-in-one tab when the query param asks for it', () => {
      const onTab = new MyPackagesComponent(
        packagesService as unknown as PackagesService,
        { getMyPurchases: vi.fn().mockReturnValue(of([])) } as any,
        categoriesService as unknown as CategoriesService,
        tracker as unknown as ActivityTrackerService,
        { snapshot: { queryParams: { tab: 'all_in_one' } } } as any,
      );
      onTab.ngOnInit();
      expect(onTab.mainTab()).toBe('all_in_one');
      expect(onTab.activeBundles().length).toBe(1);
    });
  });

  describe('meterPercent', () => {
    it('scales a balance to a percentage', () => {
      expect(component.meterPercent(3, 6)).toBe(50);
    });

    it('reports nothing rather than dividing by zero', () => {
      expect(component.meterPercent(0, 0)).toBe(0);
    });

    it('clamps the -1 a legacy purchase uses to mark processed expiry', () => {
      expect(component.meterPercent(-1, 5)).toBe(0);
    });

    it('clamps a balance that somehow exceeds the total', () => {
      expect(component.meterPercent(9, 5)).toBe(100);
    });
  });
});
