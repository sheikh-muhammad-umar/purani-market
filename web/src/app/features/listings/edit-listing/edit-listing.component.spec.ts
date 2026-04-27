import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { EditListingComponent } from './edit-listing.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService } from '../../../core/services/listings.service';
import { LocationService } from '../../../core/services/location.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { BrandsService } from '../../../core/services/brands.service';
import { ActivatedRoute } from '@angular/router';
import { Category, CategoryAttribute, Listing } from '../../../core/models';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    _id: overrides._id ?? 'cat1',
    name: overrides.name ?? 'Electronics',
    slug: overrides.slug ?? 'electronics',
    level: overrides.level ?? 1,
    parentId: overrides.parentId,
    attributes: overrides.attributes ?? [],
    filters: [],
    isActive: overrides.isActive ?? true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    _id: overrides._id ?? 'listing-1',
    sellerId: 's1',
    title: overrides.title ?? 'Test Car',
    description: overrides.description ?? 'A great car',
    price: overrides.price ?? { amount: 500000, currency: 'PKR' },
    categoryId: overrides.categoryId ?? 'c3',
    categoryPath: overrides.categoryPath ?? ['c1', 'c3'],
    condition: overrides.condition ?? 'used',
    categoryAttributes: overrides.categoryAttributes ?? { make: 'Toyota' },
    images: overrides.images ?? [
      { url: 'img1.jpg', thumbnailUrl: 'thumb1.jpg', sortOrder: 0 },
      { url: 'img2.jpg', thumbnailUrl: 'thumb2.jpg', sortOrder: 1 },
    ],
    video: overrides.video,
    location: overrides.location ?? {
      type: 'Point',
      coordinates: [74, 31],
      city: 'Lahore',
      area: 'DHA',
    },
    contactInfo: overrides.contactInfo ?? { phone: '03001234567', email: 'seller@test.com' },
    status: overrides.status ?? 'active',
    isFeatured: overrides.isFeatured ?? false,
    viewCount: 10,
    favoriteCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const mockCategories: Category[] = [
  makeCategory({ _id: 'c1', name: 'Vehicles', slug: 'vehicles', level: 1 }),
  makeCategory({ _id: 'c2', name: 'Electronics', slug: 'electronics', level: 1 }),
  makeCategory({
    _id: 'c3',
    name: 'Cars',
    slug: 'cars',
    level: 2,
    parentId: 'c1',
    attributes: [
      { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda'], required: true },
      { name: 'Mileage', key: 'mileage', type: 'number', required: false, unit: 'km' },
    ] as CategoryAttribute[],
  }),
  makeCategory({ _id: 'c4', name: 'Sedans', slug: 'sedans', level: 3, parentId: 'c3' }),
];

describe('EditListingComponent', () => {
  let component: EditListingComponent;
  let categoriesService: { getAll: ReturnType<typeof vi.fn> };
  let listingsService: { getById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let route: { snapshot: { paramMap: { get: (key: string) => string | null } } };
  let locationService: { getCities: ReturnType<typeof vi.fn> };
  let trackerMock: { track: ReturnType<typeof vi.fn> };
  let brandsService: { getByCategory: ReturnType<typeof vi.fn> };

  const mockListing = makeListing();

  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    categoriesService = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
      getInheritedAttributes: vi.fn().mockReturnValue(
        of({
          attributes: [
            {
              name: 'Make',
              key: 'make',
              type: 'select',
              options: ['Toyota', 'Honda'],
              required: true,
            },
            { name: 'Mileage', key: 'mileage', type: 'number', required: false, unit: 'km' },
          ],
          features: [],
        }),
      ),
    };
    listingsService = {
      getById: vi.fn().mockReturnValue(of(mockListing)),
      update: vi.fn().mockReturnValue(of(mockListing)),
    };
    router = { navigate: vi.fn() };
    route = { snapshot: { paramMap: { get: (_key: string) => 'listing-1' } } };
    locationService = {
      getCities: vi.fn().mockReturnValue(of([])),
      getProvinces: vi.fn().mockReturnValue(of([])),
      getAreas: vi.fn().mockReturnValue(of([])),
    };
    trackerMock = { track: vi.fn() };
    brandsService = {
      getByCategory: vi.fn().mockReturnValue(of([])),
      checkVehicleCategory: vi.fn().mockReturnValue(of({ hasVehicleBrands: false })),
      getModelsByBrand: vi.fn().mockReturnValue(of([])),
      getVariantsByModel: vi.fn().mockReturnValue(of([])),
      getVehicleBrandsByCategory: vi.fn().mockReturnValue(of([])),
    };

    component = new EditListingComponent(
      new FormBuilder(),
      route as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories and listing on init', () => {
    expect(categoriesService.getAll).toHaveBeenCalled();
    expect(listingsService.getById).toHaveBeenCalledWith('listing-1');
    expect(component.listing()).toEqual(mockListing);
    expect(component.loading()).toBe(false);
  });

  it('should populate details form from listing', () => {
    expect(component.detailsForm.get('title')!.value).toBe('Test Car');
    expect(component.detailsForm.get('description')!.value).toBe('A great car');
    expect(component.detailsForm.get('price')!.value).toBe(500000);
    expect(component.detailsForm.get('condition')!.value).toBe('used');
  });

  it('should populate location form from listing', () => {
    expect(component.locationForm.get('city')!.value).toBe('Lahore');
    expect(component.locationForm.get('area')!.value).toBe('DHA');
  });

  it('should restore category selection from listing categoryPath', () => {
    expect(component.selectedLevel1()?.name).toBe('Vehicles');
    expect(component.selectedLevel2()?.name).toBe('Cars');
  });

  it('should restore 3-level category path', () => {
    const listing3Level = makeListing({ categoryPath: ['c1', 'c3', 'c4'] });
    listingsService.getById = vi.fn().mockReturnValue(of(listing3Level));
    component = new EditListingComponent(
      new FormBuilder(),
      route as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
    expect(component.selectedLevel1()?.name).toBe('Vehicles');
    expect(component.selectedLevel2()?.name).toBe('Cars');
    expect(component.selectedLevel3()?.name).toBe('Sedans');
  });

  it('should populate dynamic category attributes from listing', () => {
    const ctrl = component.getDynamicControl('make');
    expect(ctrl.value).toBe('Toyota');
  });

  it('should restore featureAd from listing', () => {
    const featuredListing = makeListing({ isFeatured: true });
    listingsService.getById = vi.fn().mockReturnValue(of(featuredListing));
    component = new EditListingComponent(
      new FormBuilder(),
      route as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
    expect(component.featureAd()).toBe(true);
  });

  // --- Wizard navigation ---
  it('should start at step 1', () => {
    expect(component.currentStep()).toBe(1);
  });

  it('should advance to step 2 when category is valid', () => {
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('should go back to previous step', () => {
    const startStep = component.currentStep();
    component.nextStep();
    expect(component.currentStep()).toBe(startStep + 1);
    component.prevStep();
    expect(component.currentStep()).toBe(startStep);
  });

  it('should not go below step 1', () => {
    while (component.currentStep() > 1) {
      component.prevStep();
    }
    component.prevStep();
    expect(component.currentStep()).toBe(1);
  });

  it('should allow goToStep for previously completed steps', () => {
    component.nextStep(); // step 2
    component.nextStep(); // step 3 (media is always valid for edit)
    component.goToStep(1);
    expect(component.currentStep()).toBe(1);
  });

  it('should not skip to step if previous steps are invalid', () => {
    // Clear category to make step 1 invalid
    component.selectedLevel1.set(null);
    component.selectedLevel2.set(null);
    const stepBefore = component.currentStep();
    component.goToStep(5);
    // Should not advance past invalid steps
    expect(component.currentStep()).toBeLessThanOrEqual(stepBefore);
  });

  // --- Media step is always valid for edit ---
  it('should treat media step as valid for edit (existing media)', () => {
    expect(component.isStepValid(3)).toBe(true);
  });

  // --- Validation ---
  it('should validate category step', () => {
    expect(component.isCategoryStepValid()).toBe(true);
    component.selectedLevel1.set(null);
    component.selectedLevel2.set(null);
    expect(component.isCategoryStepValid()).toBe(false);
  });

  it('should validate details step with required dynamic attributes', () => {
    // Details form should be valid when populated from listing
    expect(component.isDetailsStepValid()).toBe(true);
    // Clear a required form field to make it invalid
    component.detailsForm.get('title')!.setValue('');
    expect(component.isDetailsStepValid()).toBe(false);
  });

  it('should validate location step', () => {
    expect(component.isLocationStepValid()).toBe(true);
    component.locationForm.patchValue({ city: '', area: '' });
    expect(component.isLocationStepValid()).toBe(false);
  });

  // --- Category path ---
  it('should build category path string', () => {
    expect(component.getCategoryPath()).toBe('Vehicles → Cars');
  });

  it('should build category path IDs', () => {
    expect(component.buildCategoryPathIds()).toEqual(['c1', 'c3']);
  });

  // --- Feature ad toggle ---
  it('should toggle feature ad', () => {
    expect(component.featureAd()).toBe(false);
    component.toggleFeatureAd();
    expect(component.featureAd()).toBe(true);
    component.toggleFeatureAd();
    expect(component.featureAd()).toBe(false);
  });

  // --- Submit ---
  it('should submit update and navigate on success', () => {
    component.submit();
    expect(listingsService.update).toHaveBeenCalledWith(
      'listing-1',
      expect.objectContaining({
        title: 'Test Car',
        description: 'A great car',
        price: { amount: 500000, currency: 'PKR' },
      }),
    );
    expect(component.submitting()).toBe(false);
    expect(router.navigate).toHaveBeenCalled();
  });

  it('should handle submit error', () => {
    listingsService.update = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { message: 'Forbidden' } })));
    component.submit();
    expect(component.error()).toBe('Forbidden');
    expect(component.submitting()).toBe(false);
  });

  it('should handle submit error with fallback message', () => {
    listingsService.update = vi.fn().mockReturnValue(throwError(() => ({})));
    component.submit();
    expect(component.error()).toBe('Failed to update listing.');
    expect(component.submitting()).toBe(false);
  });

  it('should not submit while already submitting', () => {
    component.submitting.set(true);
    component.submit();
    expect(listingsService.update).not.toHaveBeenCalled();
  });

  // --- Error handling ---
  it('should handle listing load error', () => {
    listingsService.getById = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new EditListingComponent(
      new FormBuilder(),
      route as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
    expect(component.error()).toBe('Failed to load listing.');
    expect(component.loading()).toBe(false);
  });

  it('should handle categories load error gracefully', () => {
    categoriesService.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new EditListingComponent(
      new FormBuilder(),
      route as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
    expect(component.allCategories().length).toBe(0);
  });

  it('should handle missing listing id', () => {
    const noIdRoute = { snapshot: { paramMap: { get: () => null } } };
    const freshListingsService = {
      getById: vi.fn().mockReturnValue(of(mockListing)),
      update: vi.fn().mockReturnValue(of(mockListing)),
    };
    component = new EditListingComponent(
      new FormBuilder(),
      noIdRoute as unknown as ActivatedRoute,
      router as any,
      categoriesService as unknown as CategoriesService,
      freshListingsService as unknown as ListingsService,
      locationService as unknown as LocationService,
      trackerMock as unknown as ActivityTrackerService,
      brandsService as unknown as BrandsService,
    );
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(freshListingsService.getById).not.toHaveBeenCalled();
  });

  // --- Category selection changes ---
  it('should reset lower levels when selecting a new level 1', () => {
    component.selectLevel1(mockCategories[1]); // Electronics
    expect(component.selectedLevel2()).toBeNull();
    expect(component.selectedLevel3()).toBeNull();
  });

  it('should reset level 3 when selecting a new level 2', () => {
    component.selectLevel3(mockCategories[3]); // Sedans
    expect(component.selectedLevel3()?.name).toBe('Sedans');
    component.selectLevel2(mockCategories[2]); // Cars again
    expect(component.selectedLevel3()).toBeNull();
  });
});
