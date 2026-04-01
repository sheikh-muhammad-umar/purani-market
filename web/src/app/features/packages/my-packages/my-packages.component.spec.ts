import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MyPackagesComponent } from './my-packages.component';
import { PackagesService } from '../../../core/services/packages.service';
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
    duration: overrides.duration ?? 7,
    price: overrides.price ?? 500,
    paymentMethod: overrides.paymentMethod ?? 'jazzcash',
    paymentStatus: overrides.paymentStatus ?? 'completed',
    paymentTransactionId: overrides.paymentTransactionId ?? 'txn1',
    activatedAt: overrides.activatedAt ?? new Date('2024-06-01'),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    createdAt: overrides.createdAt ?? new Date('2024-06-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-06-01'),
  };
}

describe('MyPackagesComponent', () => {
  let component: MyPackagesComponent;
  let packagesService: { getMyPurchases: ReturnType<typeof vi.fn> };

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
    component = new MyPackagesComponent(packagesService as unknown as PackagesService);
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
    expect(history.map(h => h._id)).toContain('expired1');
    expect(history.map(h => h._id)).toContain('failed1');
  });

  it('should switch tabs', () => {
    expect(component.activeTab()).toBe('active');
    component.setTab('history');
    expect(component.activeTab()).toBe('history');
    component.setTab('active');
    expect(component.activeTab()).toBe('active');
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
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
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
    expect(component.getPaymentMethodLabel('card')).toBe('Card');
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
    packagesService.getMyPurchases.mockReturnValue(of({ data: [expiredPurchase, failedPurchase], total: 2 }));
    component.ngOnInit();
    expect(component.activePurchases().length).toBe(0);
  });
});
