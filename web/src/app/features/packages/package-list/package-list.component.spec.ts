import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PackageListComponent } from './package-list.component';
import { PackagesService } from '../../../core/services/packages.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { AdPackage, Category } from '../../../core/models';
import { TrackingEvent } from '../../../core/enums/tracking-events';

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

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    _id: overrides._id ?? 'cat1',
    name: overrides.name ?? 'Electronics',
    slug: overrides.slug ?? 'electronics',
    level: overrides.level ?? 1,
    attributes: overrides.attributes ?? [],
    features: overrides.features ?? [],
    isActive: overrides.isActive ?? true,
    hasBrands: overrides.hasBrands ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01'),
  };
}

describe('PackageListComponent', () => {
  let component: PackageListComponent;
  let packagesService: { getAll: ReturnType<typeof vi.fn> };
  let categoriesService: { getAll: ReturnType<typeof vi.fn> };
  let tracker: { track: ReturnType<typeof vi.fn> };

  const mockCategories: Category[] = [
    makeCategory({ _id: 'cat1', name: 'Electronics' }),
    makeCategory({ _id: 'cat2', name: 'Vehicles', slug: 'vehicles' }),
  ];

  const mockPackages: AdPackage[] = [
    makePackage({
      _id: 'p1',
      name: '5 Featured Ads',
      type: 'featured_ads',
      duration: 7,
      quantity: 5,
      defaultPrice: 500,
    }),
    makePackage({
      _id: 'p2',
      name: '10 Ad Slots',
      type: 'ad_slots',
      duration: 15,
      quantity: 10,
      defaultPrice: 2000,
    }),
    makePackage({
      _id: 'p3',
      name: '10 Featured Ads',
      type: 'featured_ads',
      duration: 30,
      quantity: 10,
      defaultPrice: 3400,
      categoryPricing: [
        { categoryId: 'cat1', price: 3800 },
        { categoryId: 'cat2', price: 2900 },
      ],
    }),
  ];

  beforeEach(() => {
    packagesService = {
      getAll: vi.fn().mockReturnValue(of({ data: mockPackages, total: 3 })),
    };
    categoriesService = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
    };
    tracker = {
      track: vi.fn(),
    };
    component = new PackageListComponent(
      packagesService as unknown as PackagesService,
      categoriesService as unknown as CategoriesService,
      tracker as unknown as ActivityTrackerService,
    );
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

  it('should load categories on init', () => {
    component.ngOnInit();
    expect(categoriesService.getAll).toHaveBeenCalled();
    expect(component.categories().length).toBe(2);
  });

  it('should handle load error', () => {
    packagesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load packages. Please try again.');
  });

  it('should handle categories load error silently', () => {
    categoriesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.categories().length).toBe(0);
  });

  it('should filter by type', () => {
    component.ngOnInit();
    component.setType('featured_ads');
    expect(component.filteredPackages().length).toBe(2);
    expect(component.filteredPackages().every((p) => p.type === 'featured_ads')).toBe(true);
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
    expect(component.getTypeIcon('featured_ads')).toBe('star');
    expect(component.getTypeIcon('ad_slots')).toBe('inventory_2');
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

  // Category-specific pricing tests
  describe('category-specific pricing', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should return defaultPrice when no category is selected', () => {
      const pkg = mockPackages[2]; // has categoryPricing
      expect(component.resolvePrice(pkg)).toBe(3400);
    });

    it('should return category-specific price when matching category is selected', () => {
      component.onCategoryChange('cat1');
      const pkg = mockPackages[2];
      expect(component.resolvePrice(pkg)).toBe(3800);
    });

    it('should return different category-specific price for different category', () => {
      component.onCategoryChange('cat2');
      const pkg = mockPackages[2];
      expect(component.resolvePrice(pkg)).toBe(2900);
    });

    it('should fall back to defaultPrice when selected category has no specific pricing', () => {
      component.onCategoryChange('cat-unknown');
      const pkg = mockPackages[2];
      expect(component.resolvePrice(pkg)).toBe(3400);
    });

    it('should return defaultPrice for packages without categoryPricing', () => {
      component.onCategoryChange('cat1');
      const pkg = mockPackages[0]; // no categoryPricing
      expect(component.resolvePrice(pkg)).toBe(500);
    });

    it('should indicate category price when matching entry exists', () => {
      component.onCategoryChange('cat1');
      expect(component.isCategoryPrice(mockPackages[2])).toBe(true);
    });

    it('should not indicate category price when no matching entry', () => {
      component.onCategoryChange('cat-unknown');
      expect(component.isCategoryPrice(mockPackages[2])).toBe(false);
    });

    it('should not indicate category price when no category selected', () => {
      expect(component.isCategoryPrice(mockPackages[2])).toBe(false);
    });

    it('should reset to defaultPrice when category is cleared', () => {
      component.onCategoryChange('cat1');
      expect(component.resolvePrice(mockPackages[2])).toBe(3800);
      component.onCategoryChange('');
      expect(component.resolvePrice(mockPackages[2])).toBe(3400);
    });
  });

  // PACKAGE_PURCHASE_INITIATED event tracking tests
  describe('purchase initiated tracking', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should fire PACKAGE_PURCHASE_INITIATED when category is selected', () => {
      component.onCategoryChange('cat1');
      component.onPurchaseClick(mockPackages[2]);
      expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_PURCHASE_INITIATED, {
        metadata: {
          packageId: 'p3',
          categoryId: 'cat1',
          packageType: 'featured_ads',
          price: 3800,
        },
      });
    });

    it('should not fire PACKAGE_PURCHASE_INITIATED when no category is selected', () => {
      component.onPurchaseClick(mockPackages[0]);
      expect(tracker.track).not.toHaveBeenCalled();
    });

    it('should include defaultPrice when category has no specific pricing', () => {
      component.onCategoryChange('cat1');
      component.onPurchaseClick(mockPackages[0]); // no categoryPricing
      expect(tracker.track).toHaveBeenCalledWith(TrackingEvent.PACKAGE_PURCHASE_INITIATED, {
        metadata: {
          packageId: 'p1',
          categoryId: 'cat1',
          packageType: 'featured_ads',
          price: 500,
        },
      });
    });
  });
});
