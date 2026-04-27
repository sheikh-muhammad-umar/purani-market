import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { AvailablePackagesComponent } from './available-packages.component';
import { PackagesService } from '../../../../core/services/packages.service';
import { ActivityTrackerService } from '../../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../../core/enums/tracking-events';
import { PackagePurchase } from '../../../../core/models';

function makePurchase(overrides: Partial<PackagePurchase> = {}): PackagePurchase {
  return {
    _id: overrides._id ?? 'pur1',
    sellerId: overrides.sellerId ?? 'seller1',
    packageId: overrides.packageId ?? 'pkg1',
    categoryId: overrides.categoryId ?? 'cat1',
    type: overrides.type ?? 'featured_ads',
    quantity: overrides.quantity ?? 10,
    remainingQuantity: overrides.remainingQuantity ?? 5,
    duration: overrides.duration ?? 30,
    price: overrides.price ?? 500,
    paymentMethod: overrides.paymentMethod ?? 'jazzcash',
    paymentStatus: overrides.paymentStatus ?? 'completed',
    paymentTransactionId: overrides.paymentTransactionId ?? 'tx1',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

describe('AvailablePackagesComponent', () => {
  let component: AvailablePackagesComponent;
  let packagesService: { getAvailablePackages: ReturnType<typeof vi.fn> };
  let tracker: { track: ReturnType<typeof vi.fn> };

  const pkg1 = makePurchase({ _id: 'purchase1', type: 'featured_ads' });
  const pkg2 = makePurchase({
    _id: 'purchase2',
    type: 'ad_slots',
    remainingQuantity: 2,
    quantity: 5,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });
  const mockPackages: PackagePurchase[] = [pkg1, pkg2];

  beforeEach(() => {
    packagesService = {
      getAvailablePackages: vi.fn().mockReturnValue(of(mockPackages)),
    };
    tracker = {
      track: vi.fn(),
    };
    component = new AvailablePackagesComponent(
      packagesService as unknown as PackagesService,
      tracker as unknown as ActivityTrackerService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load packages when categoryId changes', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    expect(packagesService.getAvailablePackages).toHaveBeenCalledWith('cat1');
    expect(component.packages().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should fire PACKAGE_LIST_VIEWED event on load', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_LIST_VIEWED, {
      categoryId: 'cat1',
      metadata: { categoryId: 'cat1', availablePackageCount: 2 },
    });
  });

  it('should fire PACKAGE_NONE_AVAILABLE event when no packages exist', () => {
    packagesService.getAvailablePackages.mockReturnValue(of([]));

    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_NONE_AVAILABLE, {
      categoryId: 'cat1',
      metadata: { categoryId: 'cat1' },
    });
  });

  it('should not fire PACKAGE_NONE_AVAILABLE when packages exist', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const noneAvailableCalls = tracker.track.mock.calls.filter(
      (args: any[]) => args[0] === TrackingEvent.PACKAGE_NONE_AVAILABLE,
    );
    expect(noneAvailableCalls.length).toBe(0);
  });

  it('should emit purchaseId and fire PACKAGE_APPLY event when a package is selected', () => {
    const emitSpy = vi.fn();
    component.packageSelected.emit = emitSpy;
    component.categoryId = 'cat1';
    component.listingId = 'listing1';

    component.selectPackage(pkg1);

    expect(component.selectedPurchaseId()).toBe('purchase1');
    expect(emitSpy).toHaveBeenCalledWith('purchase1');
    expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_APPLY, {
      categoryId: 'cat1',
      metadata: {
        purchaseId: 'purchase1',
        packageType: 'featured_ads',
        categoryId: 'cat1',
        listingId: 'listing1',
      },
    });
  });

  it('should emit empty string when package is deselected', () => {
    const emitSpy = vi.fn();
    component.packageSelected.emit = emitSpy;
    component.selectedPurchaseId.set('purchase1');

    component.deselectPackage();

    expect(component.selectedPurchaseId()).toBeNull();
    expect(emitSpy).toHaveBeenCalledWith('');
  });

  it('should fire PACKAGE_PURCHASE_CTA_CLICKED event when purchase link is clicked', () => {
    component.categoryId = 'cat1';
    component.onPurchaseLinkClick();

    expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_PURCHASE_CTA_CLICKED, {
      categoryId: 'cat1',
      metadata: { categoryId: 'cat1', source: 'listing_creation' },
    });
  });

  it('should handle API errors gracefully', () => {
    packagesService.getAvailablePackages.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    expect(component.error()).toBe('Failed to load available packages.');
    expect(component.loading()).toBe(false);
  });

  it('should reset selection when categoryId changes', () => {
    component.selectedPurchaseId.set('purchase1');
    component.categoryId = 'cat2';
    component.ngOnChanges({
      categoryId: new SimpleChange('cat1', 'cat2', false),
    });

    expect(component.selectedPurchaseId()).toBeNull();
  });

  it('should clear packages when categoryId is null', () => {
    component.categoryId = null;
    component.ngOnChanges({
      categoryId: new SimpleChange('cat1', null, false),
    });

    expect(component.packages()).toEqual([]);
    expect(packagesService.getAvailablePackages).not.toHaveBeenCalled();
  });

  it('should return correct type labels via packageDisplayData', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const data = component.packageDisplayData();
    const featured = data.find((d) => d.type === 'featured_ads');
    const adSlots = data.find((d) => d.type === 'ad_slots');
    expect(featured?.typeLabel).toBe('Featured Ads');
    expect(adSlots?.typeLabel).toBe('Ad Slots');
  });

  it('should format dates correctly via packageDisplayData', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const data = component.packageDisplayData();
    expect(data.length).toBeGreaterThan(0);
    // All items should have a formatted date string
    for (const item of data) {
      expect(typeof item.formattedDate).toBe('string');
      expect(item.formattedDate).not.toBe('');
    }
  });

  it('should calculate remaining days via packageDisplayData', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const data = component.packageDisplayData();
    expect(data.length).toBeGreaterThan(0);
    for (const item of data) {
      expect(item.remainingDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get package name from populated packageId via packageDisplayData', () => {
    const populated = { ...pkg1, packageId: { name: 'Gold Package', type: 'featured_ads' } };
    packagesService.getAvailablePackages.mockReturnValue(of([populated]));

    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const data = component.packageDisplayData();
    expect(data[0].name).toBe('Gold Package');
  });

  it('should fallback to "Package" when packageId is not populated', () => {
    component.categoryId = 'cat1';
    component.ngOnChanges({
      categoryId: new SimpleChange(null, 'cat1', true),
    });

    const data = component.packageDisplayData();
    // pkg1 has packageId as a plain string, not populated
    const item = data.find((d) => d.pkg._id === pkg1._id);
    expect(item?.name).toBe('Package');
  });
});
