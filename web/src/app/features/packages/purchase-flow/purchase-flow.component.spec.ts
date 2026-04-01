import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PurchaseFlowComponent } from './purchase-flow.component';
import { PackagesService } from '../../../core/services/packages.service';
import { AdPackage } from '../../../core/models';

function makePackage(overrides: Partial<AdPackage> = {}): AdPackage {
  return {
    _id: overrides._id ?? 'pkg1',
    name: overrides.name ?? '5 Featured Ads',
    type: overrides.type ?? 'featured_ads',
    duration: overrides.duration ?? 7,
    quantity: overrides.quantity ?? 5,
    defaultPrice: overrides.defaultPrice ?? 500,
    categoryPricing: overrides.categoryPricing ?? [],
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01'),
  };
}

function createComponent(
  packageId: string,
  packagesService: Record<string, ReturnType<typeof vi.fn>>,
): PurchaseFlowComponent {
  const route = {
    snapshot: { paramMap: { get: (key: string) => key === 'id' ? packageId : null } },
  } as any;
  return new PurchaseFlowComponent(route, packagesService as unknown as PackagesService);
}

describe('PurchaseFlowComponent', () => {
  let component: PurchaseFlowComponent;
  let packagesService: {
    getById: ReturnType<typeof vi.fn>;
    purchase: ReturnType<typeof vi.fn>;
  };

  const mockPkg = makePackage();

  beforeEach(() => {
    packagesService = {
      getById: vi.fn().mockReturnValue(of(mockPkg)),
      purchase: vi.fn().mockReturnValue(of({ redirectUrl: 'https://pay.example.com/checkout', transactionId: 'txn123' })),
    };
    component = createComponent('pkg1', packagesService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load package on init', () => {
    component.ngOnInit();
    expect(packagesService.getById).toHaveBeenCalledWith('pkg1');
    expect(component.pkg()).toEqual(mockPkg);
    expect(component.loading()).toBe(false);
    expect(component.step()).toBe('details');
  });

  it('should handle missing package ID', () => {
    component = createComponent('', packagesService);
    component.ngOnInit();
    expect(component.error()).toBe('Invalid package ID.');
    expect(component.loading()).toBe(false);
  });

  it('should handle load error', () => {
    packagesService.getById.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).toBe('Failed to load package details.');
    expect(component.loading()).toBe(false);
  });

  it('should navigate to payment step', () => {
    component.ngOnInit();
    component.goToPayment();
    expect(component.step()).toBe('payment');
  });

  it('should select payment method', () => {
    component.selectPaymentMethod('jazzcash');
    expect(component.selectedPaymentMethod()).toBe('jazzcash');
  });

  it('should navigate to confirm step when payment method selected', () => {
    component.selectPaymentMethod('easypaisa');
    component.goToConfirm();
    expect(component.step()).toBe('confirm');
  });

  it('should not navigate to confirm without payment method', () => {
    component.goToConfirm();
    expect(component.step()).not.toBe('confirm');
  });

  it('should go back from payment to details', () => {
    component.ngOnInit();
    component.goToPayment();
    expect(component.step()).toBe('payment');
    component.goBack();
    expect(component.step()).toBe('details');
  });

  it('should go back from confirm to payment', () => {
    component.selectPaymentMethod('card');
    component.goToConfirm();
    expect(component.step()).toBe('confirm');
    component.goBack();
    expect(component.step()).toBe('payment');
  });

  it('should initiate purchase and redirect', () => {
    // Mock window.location.href
    const originalLocation = window.location;
    const mockLocation = { href: '' } as Location;
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true });

    component.ngOnInit();
    component.selectPaymentMethod('jazzcash');
    component.confirmPurchase();

    expect(packagesService.purchase).toHaveBeenCalledWith({
      packageId: 'pkg1',
      paymentMethod: 'jazzcash',
    });
    expect(component.purchasing()).toBe(false);
    expect(mockLocation.href).toBe('https://pay.example.com/checkout');

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('should handle purchase error', () => {
    packagesService.purchase.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.selectPaymentMethod('card');
    component.confirmPurchase();
    expect(component.purchaseError()).toBe('Payment initiation failed. Please try again.');
    expect(component.purchasing()).toBe(false);
  });

  it('should not purchase without payment method', () => {
    component.ngOnInit();
    component.confirmPurchase();
    expect(packagesService.purchase).not.toHaveBeenCalled();
  });

  it('should format price correctly', () => {
    expect(component.formatPrice(500)).toBe('Rs 500');
    expect(component.formatPrice(3400)).toContain('3');
  });

  it('should return correct type labels', () => {
    expect(component.getTypeLabel('featured_ads')).toBe('Featured Ads');
    expect(component.getTypeLabel('ad_slots')).toBe('Ad Slots');
  });

  it('should return correct payment method labels', () => {
    expect(component.getPaymentMethodLabel('jazzcash')).toBe('JazzCash');
    expect(component.getPaymentMethodLabel('easypaisa')).toBe('EasyPaisa');
    expect(component.getPaymentMethodLabel('card')).toBe('Credit/Debit Card');
  });

  it('should return correct payment method icons', () => {
    expect(component.getPaymentMethodIcon('jazzcash')).toBe('📱');
    expect(component.getPaymentMethodIcon('easypaisa')).toBe('📲');
    expect(component.getPaymentMethodIcon('card')).toBe('💳');
  });

  it('should return correct step numbers', () => {
    expect(component.getStepNumber()).toBe(1);
    component.goToPayment();
    expect(component.getStepNumber()).toBe(2);
    component.selectPaymentMethod('card');
    component.goToConfirm();
    expect(component.getStepNumber()).toBe(3);
  });
});
