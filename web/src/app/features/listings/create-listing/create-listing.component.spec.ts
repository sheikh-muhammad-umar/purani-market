import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { CreateListingComponent, MediaItem } from './create-listing.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService } from '../../../core/services/listings.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Category, CategoryAttribute } from '../../../core/models';

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

describe('CreateListingComponent', () => {
  let component: CreateListingComponent;
  let categoriesService: { getAll: ReturnType<typeof vi.fn> };
  let listingsService: { create: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authService: {
    fetchCurrentUser: ReturnType<typeof vi.fn>;
    user: ReturnType<typeof vi.fn>;
    verifyPhone: ReturnType<typeof vi.fn>;
    resendVerification: ReturnType<typeof vi.fn>;
    addPhone: ReturnType<typeof vi.fn>;
    verifyPhoneChange: ReturnType<typeof vi.fn>;
  };

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
    makeCategory({ _id: 'c5', name: 'Inactive', slug: 'inactive', level: 1, isActive: false }),
  ];

  beforeEach(() => {
    categoriesService = { getAll: vi.fn().mockReturnValue(of(mockCategories)) };
    listingsService = { create: vi.fn().mockReturnValue(of({ _id: 'new1' })) };
    router = { navigate: vi.fn() };
    authService = {
      fetchCurrentUser: vi.fn().mockReturnValue(of({ phone: '03001234567', phoneVerified: true })),
      user: vi.fn().mockReturnValue({ phone: '03001234567', phoneVerified: true }),
      verifyPhone: vi.fn(),
      resendVerification: vi.fn(),
      addPhone: vi.fn(),
      verifyPhoneChange: vi.fn(),
    };

    component = new CreateListingComponent(
      new FormBuilder(),
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      authService as unknown as AuthService,
    );
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start at step 1', () => {
    expect(component.currentStep()).toBe(1);
  });

  it('should load categories on init', () => {
    expect(categoriesService.getAll).toHaveBeenCalled();
    expect(component.allCategories().length).toBe(5);
  });

  it('should filter level 1 active categories', () => {
    const l1 = component.level1Categories();
    expect(l1.length).toBe(2);
    expect(l1.map((c) => c.name)).toEqual(['Vehicles', 'Electronics']);
  });

  // --- Category Step ---
  it('should select level 1 category and show children', () => {
    component.selectLevel1(mockCategories[0]); // Vehicles
    expect(component.selectedLevel1()?.name).toBe('Vehicles');
    expect(component.level2Categories().length).toBe(1);
    expect(component.level2Categories()[0].name).toBe('Cars');
  });

  it('should select level 2 category and show children', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]); // Cars
    expect(component.selectedLevel2()?.name).toBe('Cars');
    expect(component.level3Categories().length).toBe(1);
  });

  it('should select level 3 category', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]);
    component.selectLevel3(mockCategories[3]); // Sedans
    expect(component.selectedLevel3()?.name).toBe('Sedans');
    expect(component.selectedCategory()?.name).toBe('Sedans');
  });

  it('should reset lower levels when selecting a new level 1', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]);
    component.selectLevel1(mockCategories[1]); // Electronics
    expect(component.selectedLevel2()).toBeNull();
    expect(component.selectedLevel3()).toBeNull();
    expect(component.level3Categories().length).toBe(0);
  });

  it('should validate category step', () => {
    expect(component.isCategoryStepValid()).toBe(false);
    component.selectLevel1(mockCategories[0]);
    expect(component.isCategoryStepValid()).toBe(true);
  });

  // --- Navigation ---
  it('should not advance if current step is invalid', () => {
    component.nextStep(); // no category selected
    expect(component.currentStep()).toBe(1);
  });

  it('should advance to step 2 when category is selected', () => {
    component.selectLevel1(mockCategories[0]);
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('should go back to previous step', () => {
    component.selectLevel1(mockCategories[0]);
    component.nextStep();
    expect(component.currentStep()).toBe(2);
    component.prevStep();
    expect(component.currentStep()).toBe(1);
  });

  it('should not go below step 1', () => {
    component.prevStep();
    expect(component.currentStep()).toBe(1);
  });

  // --- Details Step ---
  it('should validate details step - invalid when empty', () => {
    expect(component.isDetailsStepValid()).toBe(false);
  });

  it('should validate details step - valid with all fields', () => {
    component.detailsForm.patchValue({
      title: 'Test Item',
      description: 'A great item',
      price: 5000,
      condition: 'used',
    });
    expect(component.isDetailsStepValid()).toBe(true);
  });

  it('should validate required dynamic attributes', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]); // Cars with required 'make'

    component.detailsForm.patchValue({
      title: 'Test Car',
      description: 'A great car',
      price: 500000,
      condition: 'used',
    });

    // 'make' is required but not set
    expect(component.isDetailsStepValid()).toBe(false);

    component.getDynamicControl('make').setValue('Toyota');
    expect(component.isDetailsStepValid()).toBe(true);
  });

  // --- Media Step ---
  it('should require at least 2 images', () => {
    expect(component.isMediaStepValid()).toBe(false);
  });

  it('should validate media step with 2+ images', () => {
    const items: MediaItem[] = [
      { file: new File([''], 'a.jpg'), preview: 'blob:a', type: 'image' },
      { file: new File([''], 'b.jpg'), preview: 'blob:b', type: 'image' },
    ];
    component.mediaItems.set(items);
    expect(component.isMediaStepValid()).toBe(true);
  });

  it('should remove an image', () => {
    const items: MediaItem[] = [
      { file: new File([''], 'a.jpg'), preview: 'blob:a', type: 'image' },
      { file: new File([''], 'b.jpg'), preview: 'blob:b', type: 'image' },
      { file: new File([''], 'c.jpg'), preview: 'blob:c', type: 'image' },
    ];
    component.mediaItems.set(items);
    component.removeImage(1);
    expect(component.mediaItems().length).toBe(2);
    expect(component.mediaItems()[1].preview).toBe('blob:c');
  });

  it('should reorder images', () => {
    const items: MediaItem[] = [
      { file: new File([''], 'a.jpg'), preview: 'blob:a', type: 'image' },
      { file: new File([''], 'b.jpg'), preview: 'blob:b', type: 'image' },
      { file: new File([''], 'c.jpg'), preview: 'blob:c', type: 'image' },
    ];
    component.mediaItems.set(items);
    component.moveImage(0, 1);
    expect(component.mediaItems()[0].preview).toBe('blob:b');
    expect(component.mediaItems()[1].preview).toBe('blob:a');
  });

  it('should not move image out of bounds', () => {
    const items: MediaItem[] = [
      { file: new File([''], 'a.jpg'), preview: 'blob:a', type: 'image' },
    ];
    component.mediaItems.set(items);
    component.moveImage(0, -1);
    expect(component.mediaItems()[0].preview).toBe('blob:a');
  });

  it('should set and remove video', () => {
    const video: MediaItem = { file: new File([''], 'v.mp4'), preview: 'blob:v', type: 'video' };
    component.videoItem.set(video);
    expect(component.videoItem()).toBeTruthy();
    component.removeVideo();
    expect(component.videoItem()).toBeNull();
  });

  // --- Location Step ---
  it('should validate location step', () => {
    expect(component.isLocationStepValid()).toBe(false);
    component.locationForm.patchValue({ city: 'Lahore', area: 'Gulberg' });
    expect(component.isLocationStepValid()).toBe(true);
  });

  // --- Category Path ---
  it('should build category path string', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]);
    expect(component.getCategoryPath()).toBe('Vehicles → Cars');
  });

  it('should build category path IDs', () => {
    component.selectLevel1(mockCategories[0]);
    component.selectLevel2(mockCategories[2]);
    component.selectLevel3(mockCategories[3]);
    expect(component.buildCategoryPathIds()).toEqual(['c1', 'c3', 'c4']);
  });

  // --- Feature Ad ---
  it('should toggle feature ad', () => {
    expect(component.featureAd()).toBe(false);
    component.toggleFeatureAd();
    expect(component.featureAd()).toBe(true);
    component.toggleFeatureAd();
    expect(component.featureAd()).toBe(false);
  });

  // --- Submit ---
  it('should submit listing and navigate on success', () => {
    component.selectLevel1(mockCategories[0]);
    component.detailsForm.patchValue({
      title: 'Test',
      description: 'Desc',
      price: 1000,
      condition: 'new',
    });
    component.locationForm.patchValue({ city: 'Lahore', area: 'DHA' });

    component.submit();

    expect(listingsService.create).toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/listings', 'new1']);
  });

  it('should handle submit error', () => {
    listingsService.create = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { message: 'Ad limit reached' } })));
    component.selectLevel1(mockCategories[0]);
    component.detailsForm.patchValue({
      title: 'Test',
      description: 'Desc',
      price: 1000,
      condition: 'new',
    });
    component.locationForm.patchValue({ city: 'Lahore', area: 'DHA' });

    component.submit();

    expect(component.error()).toBe('Ad limit reached');
    expect(component.submitting()).toBe(false);
  });

  it('should not submit while already submitting', () => {
    component.selectLevel1(mockCategories[0]);
    component.detailsForm.patchValue({
      title: 'Test',
      description: 'Desc',
      price: 1000,
      condition: 'new',
    });
    component.locationForm.patchValue({ city: 'Lahore', area: 'DHA' });

    component.submitting.set(true);
    component.submit();
    expect(listingsService.create).not.toHaveBeenCalled();
  });

  // --- goToStep ---
  it('should allow going to a previously completed step', () => {
    component.selectLevel1(mockCategories[0]);
    component.nextStep(); // go to 2
    component.goToStep(1);
    expect(component.currentStep()).toBe(1);
  });

  it('should not allow skipping to a step if previous steps are invalid', () => {
    component.goToStep(3);
    expect(component.currentStep()).toBe(1); // stays at 1
  });

  // --- Handle categories load error ---
  it('should handle categories load error gracefully', () => {
    categoriesService.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    const comp = new CreateListingComponent(
      new FormBuilder(),
      router as any,
      categoriesService as unknown as CategoriesService,
      listingsService as unknown as ListingsService,
      authService as unknown as AuthService,
    );
    comp.ngOnInit();
    expect(comp.allCategories().length).toBe(0);
  });
});
