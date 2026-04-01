import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PackageListComponent } from './package-list.component';
import { PackagesService } from '../../../core/services/packages.service';
import { AdPackage } from '../../../core/models';

function makePackage(overrides: Partial<AdPackage> = {}): AdPackage {
  return {
    _id: overrides._id ?? 'pkg1',
    name: overrides.name ?? 'Basic Featured',
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

describe('PackageListComponent', () => {
  let component: PackageListComponent;
  let packagesService: { getAll: ReturnType<typeof vi.fn> };

  const mockPackages: AdPackage[] = [
    makePackage({ _id: 'p1', name: '5 Featured Ads', type: 'featured_ads', duration: 7, quantity: 5, defaultPrice: 500 }),
    makePackage({ _id: 'p2', name: '10 Ad Slots', type: 'ad_slots', duration: 15, quantity: 10, defaultPrice: 2000 }),
    makePackage({ _id: 'p3', name: '10 Featured Ads', type: 'featured_ads', duration: 30, quantity: 10, defaultPrice: 3400, categoryPricing: [{ categoryId: 'cat1', price: 3800 }] }),
  ];

  beforeEach(() => {
    packagesService = {
      getAll: vi.fn().mockReturnValue(of({ data: mockPackages, total: 3 })),
    };
    component = new PackageListComponent(packagesService as unknown as PackagesService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load packages on init', () => {
    component.ngOnInit();
    expect(packagesService.getAll).toHaveBeenCalled();
    expect(component.packages().length).toBe(3);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should handle load error', () => {
    packagesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load packages. Please try again.');
  });

  it('should filter by type', () => {
    component.ngOnInit();
    component.setType('featured_ads');
    expect(component.filteredPackages().length).toBe(2);
    expect(component.filteredPackages().every(p => p.type === 'featured_ads')).toBe(true);
  });

  it('should filter by ad_slots type', () => {
    component.ngOnInit();
    component.setType('ad_slots');
    expect(component.filteredPackages().length).toBe(1);
    expect(component.filteredPackages()[0].type).toBe('ad_slots');
  });

  it('should show all when type is all', () => {
    component.ngOnInit();
    component.setType('all');
    expect(component.filteredPackages().length).toBe(3);
  });

  it('should filter by duration', () => {
    component.ngOnInit();
    component.setDuration(7);
    expect(component.filteredPackages().length).toBe(1);
    expect(component.filteredPackages()[0].duration).toBe(7);
  });

  it('should combine type and duration filters', () => {
    component.ngOnInit();
    component.setType('featured_ads');
    component.setDuration(30);
    expect(component.filteredPackages().length).toBe(1);
    expect(component.filteredPackages()[0]._id).toBe('p3');
  });

  it('should clear duration filter', () => {
    component.ngOnInit();
    component.setDuration(7);
    expect(component.filteredPackages().length).toBe(1);
    component.setDuration(null);
    expect(component.filteredPackages().length).toBe(3);
  });

  it('should format price correctly', () => {
    expect(component.formatPrice(500)).toBe('Rs 500');
    expect(component.formatPrice(3400)).toContain('3');
  });

  it('should return correct type labels', () => {
    expect(component.getTypeLabel('featured_ads')).toBe('Featured Ads');
    expect(component.getTypeLabel('ad_slots')).toBe('Ad Slots');
  });

  it('should return correct type icons', () => {
    expect(component.getTypeIcon('featured_ads')).toBe('⭐');
    expect(component.getTypeIcon('ad_slots')).toBe('📦');
  });

  it('should return correct duration label', () => {
    expect(component.getDurationLabel(7)).toBe('7 days');
    expect(component.getDurationLabel(30)).toBe('30 days');
  });

  it('should show empty state when no packages match filter', () => {
    component.ngOnInit();
    component.setType('ad_slots');
    component.setDuration(7);
    expect(component.filteredPackages().length).toBe(0);
  });

  it('should retry loading on loadPackages call', () => {
    packagesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error()).not.toBeNull();

    packagesService.getAll.mockReturnValue(of({ data: mockPackages, total: 3 }));
    component.loadPackages();
    expect(component.error()).toBeNull();
    expect(component.packages().length).toBe(3);
  });
});
