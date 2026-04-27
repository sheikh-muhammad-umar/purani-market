import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PackageManagerComponent } from './package-manager.component';
import { AdminService } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AdPackage } from '../../../core/models';

const mockPackages: AdPackage[] = [
  {
    _id: 'p1',
    name: 'Featured 5',
    type: 'featured_ads',
    duration: 7,
    quantity: 5,
    defaultPrice: 500,
    categoryPricing: [{ categoryId: 'c1', price: 600 }],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'p2',
    name: 'Ad Slots 10',
    type: 'ad_slots',
    duration: 30,
    quantity: 10,
    defaultPrice: 3800,
    categoryPricing: [],
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockCategories = [
  {
    _id: 'c1',
    name: 'Electronics',
    slug: 'electronics',
    level: 1,
    attributes: [],
    filters: [],
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function createMockAdminService() {
  return {
    getAdminPackages: vi.fn().mockReturnValue(of({ data: mockPackages, total: 2 })),
    createPackage: vi.fn().mockReturnValue(of(mockPackages[0])),
    updatePackage: vi.fn().mockReturnValue(of(mockPackages[0])),
    getAdminPurchases: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 10 })),
    getAdminPayments: vi.fn(),
  };
}

function createMockCategoriesService() {
  return {
    getAll: vi.fn().mockReturnValue(of(mockCategories)),
  };
}

describe('PackageManagerComponent', () => {
  let component: PackageManagerComponent;
  let adminService: ReturnType<typeof createMockAdminService>;
  let categoriesService: ReturnType<typeof createMockCategoriesService>;

  beforeEach(() => {
    adminService = createMockAdminService();
    categoriesService = createMockCategoriesService();
    component = new PackageManagerComponent(
      adminService as unknown as AdminService,
      categoriesService as unknown as CategoriesService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Loading ---
  it('should load packages and categories on init', () => {
    component.ngOnInit();
    expect(adminService.getAdminPackages).toHaveBeenCalled();
    expect(categoriesService.getAll).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.packages().length).toBe(2);
    expect(component.categories().length).toBe(1);
  });

  it('should handle load packages error', () => {
    adminService.getAdminPackages.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load packages.');
  });

  it('should handle load categories error gracefully', () => {
    categoriesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    // Should not set error for categories failure
    expect(component.categories().length).toBe(0);
  });

  // --- Tab switching ---
  it('should switch to purchases tab and load purchases', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    expect(component.activeTab).toBe('purchases');
    expect(adminService.getAdminPurchases).toHaveBeenCalled();
  });

  it('should switch back to packages tab', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.switchTab('packages');
    expect(component.activeTab).toBe('packages');
    expect(component.activePanel).toBe('none');
  });

  // --- Create ---
  it('should open create form with defaults', () => {
    component.openCreateForm();
    expect(component.activePanel).toBe('create');
    expect(component.formName).toBe('');
    expect(component.formType).toBe('featured_ads');
    expect(component.formDuration).toBe(7);
    expect(component.formQuantity).toBe(5);
    expect(component.formDefaultPrice).toBe(500);
    expect(component.formIsActive).toBe(true);
    expect(component.formCategoryPricing.length).toBe(0);
  });

  it('should submit create and reload', () => {
    component.ngOnInit();
    component.openCreateForm();
    component.formName = 'New Package';
    component.formType = 'ad_slots';
    component.formDuration = 15;
    component.formQuantity = 10;
    component.formDefaultPrice = 2000;
    component.submitCreate();
    expect(adminService.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Package',
        type: 'ad_slots',
        duration: 15,
        quantity: 10,
        defaultPrice: 2000,
        isActive: true,
      }),
    );
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should not submit create with empty name', () => {
    component.ngOnInit();
    component.openCreateForm();
    component.formName = '';
    component.submitCreate();
    expect(adminService.createPackage).not.toHaveBeenCalled();
  });

  it('should include category pricing in create payload', () => {
    component.ngOnInit();
    component.openCreateForm();
    component.formName = 'With Pricing';
    component.formCategoryPricing = [{ categoryIds: ['c1'], price: 700 }];
    component.submitCreate();
    expect(adminService.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryPricing: [{ categoryId: 'c1', price: 700 }],
      }),
    );
  });

  it('should handle create error', () => {
    adminService.createPackage.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openCreateForm();
    component.formName = 'Test';
    component.submitCreate();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to create package.');
  });

  // --- Edit ---
  it('should open edit form with package data', () => {
    component.ngOnInit();
    component.openEditForm(mockPackages[0]);
    expect(component.activePanel).toBe('edit');
    expect(component.formName).toBe('Featured 5');
    expect(component.formType).toBe('featured_ads');
    expect(component.formDuration).toBe(7);
    expect(component.formQuantity).toBe(5);
    expect(component.formDefaultPrice).toBe(500);
    expect(component.formIsActive).toBe(true);
    expect(component.formCategoryPricing.length).toBe(1);
    expect(component.formCategoryPricing[0].categoryIds).toContain('c1');
  });

  it('should submit edit and reload', () => {
    component.ngOnInit();
    component.openEditForm(mockPackages[0]);
    component.formName = 'Updated Featured';
    component.submitEdit();
    expect(adminService.updatePackage).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ name: 'Updated Featured' }),
    );
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
    expect(component.editingPackage).toBeNull();
  });

  it('should not submit edit with empty name', () => {
    component.ngOnInit();
    component.openEditForm(mockPackages[0]);
    component.formName = '';
    component.submitEdit();
    expect(adminService.updatePackage).not.toHaveBeenCalled();
  });

  it('should not submit edit without editing package', () => {
    component.ngOnInit();
    component.editingPackage = null;
    component.formName = 'Test';
    component.submitEdit();
    expect(adminService.updatePackage).not.toHaveBeenCalled();
  });

  it('should handle edit error', () => {
    adminService.updatePackage.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openEditForm(mockPackages[0]);
    component.formName = 'Updated';
    component.submitEdit();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to update package.');
  });

  // --- Cancel ---
  it('should cancel form', () => {
    component.openCreateForm();
    component.cancelForm();
    expect(component.activePanel).toBe('none');
    expect(component.editingPackage).toBeNull();
  });

  // --- Category Pricing ---
  it('should add category price entry', () => {
    component.addCategoryPrice();
    expect(component.formCategoryPricing.length).toBe(1);
    expect(component.formCategoryPricing[0]).toEqual({ categoryIds: [], price: 0 });
  });

  it('should remove category price entry', () => {
    component.formCategoryPricing = [{ categoryIds: ['c1'], price: 500 }];
    component.removeCategoryPrice(0);
    expect(component.formCategoryPricing.length).toBe(0);
  });

  it('should get category name by id', () => {
    component.ngOnInit();
    expect(component.getCategoryName('c1')).toBe('Electronics');
    expect(component.getCategoryName('unknown')).toBe('unknown');
  });

  // --- Purchase Filters ---
  it('should apply purchase filters and reset page', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.purchaseFilterType = 'featured_ads';
    component.purchasePage = 3;
    component.applyPurchaseFilters();
    expect(component.purchasePage).toBe(1);
    expect(adminService.getAdminPurchases).toHaveBeenCalled();
  });

  it('should reset purchase filters', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.purchaseFilterType = 'featured_ads';
    component.purchaseFilterStatus = 'completed';
    component.resetPurchaseFilters();
    expect(component.purchaseFilterType).toBe('');
    expect(component.purchaseFilterStatus).toBe('');
    expect(component.purchasePage).toBe(1);
  });

  it('should handle purchase load error', () => {
    adminService.getAdminPurchases.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.switchTab('purchases');
    expect(component.error()).toBe('Failed to load purchases.');
  });

  // --- Pagination ---
  it('should go to next purchase page', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.nextPurchasePage();
    expect(component.purchasePage).toBe(2);
  });

  it('should go to previous purchase page', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.purchasePage = 3;
    component.prevPurchasePage();
    expect(component.purchasePage).toBe(2);
  });

  it('should not go below page 1', () => {
    component.ngOnInit();
    component.switchTab('purchases');
    component.purchasePage = 1;
    component.prevPurchasePage();
    expect(component.purchasePage).toBe(1);
  });

  it('should calculate total purchase pages', () => {
    component.ngOnInit();
    component.purchasesTotal.set(25);
    expect(component.totalPurchasePages).toBe(3);
  });

  it('should return 1 for zero total pages', () => {
    component.purchasesTotal.set(0);
    expect(component.totalPurchasePages).toBe(1);
  });

  it('trackByIndex should return the index', () => {
    expect(component.trackByIndex(3)).toBe(3);
  });
});
