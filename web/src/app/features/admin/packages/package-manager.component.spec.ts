import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PackageManagerComponent } from './package-manager.component';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AuthService } from '../../../core/auth/auth.service';
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

const mockBundle: AdPackage = {
  _id: 'p3',
  name: 'All in One 60',
  type: 'bundle',
  duration: 60,
  quantity: 18,
  entitlements: [
    { kind: 'featured_ads', quantity: 3 },
    { kind: 'ad_slots', quantity: 10 },
    { kind: 'shorts', quantity: 5 },
  ],
  defaultPrice: 1800,
  categoryPricing: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockAdminService() {
  return {
    getAdminPackages: vi
      .fn()
      .mockReturnValue(of({ data: [...mockPackages, mockBundle], total: 3 })),
    createPackage: vi.fn().mockReturnValue(of(mockPackages[0])),
    updatePackage: vi.fn().mockReturnValue(of(mockPackages[0])),
    deletePackage: vi.fn().mockReturnValue(of({ id: 'p1', deleted: true, purchaseCount: 0 })),
    getAdminPurchases: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 10 })),
    getAdminPayments: vi.fn(),
  };
}

function createMockCategoriesService() {
  return {
    getAll: vi.fn().mockReturnValue(of(mockCategories)),
  };
}

/** The screen reads its mode from the route, and bundle rights from the role. */
function build(options: { bundleMode?: boolean; superAdmin?: boolean } = {}) {
  const adminService = createMockAdminService();
  const categoriesService = createMockCategoriesService();
  const auth = { isSuperAdmin: () => options.superAdmin === true };
  const route = { snapshot: { data: { bundleMode: options.bundleMode === true } } };
  const component = new PackageManagerComponent(
    adminService as unknown as AdminService,
    categoriesService as unknown as CategoriesService,
    auth as unknown as AuthService,
    route as unknown as ActivatedRoute,
  );
  return { component, adminService, categoriesService };
}

describe('PackageManagerComponent', () => {
  let component: PackageManagerComponent;
  let adminService: ReturnType<typeof createMockAdminService>;
  let categoriesService: ReturnType<typeof createMockCategoriesService>;

  beforeEach(() => {
    ({ component, adminService, categoriesService } = build());
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
    expect(component.packages().length).toBe(3);
    expect(component.categories().length).toBe(1);
  });

  it('should handle load packages error', () => {
    adminService.getAdminPackages.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load packages. Please try again.');
  });

  it('should handle load categories error gracefully', () => {
    categoriesService.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    // Should not set error for categories failure
    expect(component.categories().length).toBe(0);
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

  it('trackByIndex should return the index', () => {
    expect(component.trackByIndex(3)).toBe(3);
  });

  // --- Which packages each mode lists ---
  it('leaves all-in-one packages off the ad package list', () => {
    component.ngOnInit();
    expect(component.filteredPackages.map((p) => p._id)).toEqual(['p1', 'p2']);
  });

  it('lists only all-in-one packages in bundle mode', () => {
    const { component: bundleScreen } = build({ bundleMode: true, superAdmin: true });
    bundleScreen.ngOnInit();
    expect(bundleScreen.filteredPackages.map((p) => p._id)).toEqual(['p3']);
    expect(bundleScreen.listTitle).toBe('All in One Packages');
  });

  it('offers the longer terms only in bundle mode', () => {
    const { component: bundleScreen } = build({ bundleMode: true, superAdmin: true });
    expect(bundleScreen.durationOptions.map((o) => o.value)).toContain(90);
    expect(component.durationOptions.map((o) => o.value)).not.toContain(90);
  });

  it('never offers all-in-one as a type on the ad package form', () => {
    expect(component.typeOptions.map((o) => o.value)).not.toContain('bundle');
  });

  // --- All-in-one authoring ---
  it('opens a new all-in-one on all three kinds', () => {
    const { component: bundleScreen } = build({ bundleMode: true, superAdmin: true });
    bundleScreen.openCreateForm();
    expect(bundleScreen.formType).toBe('bundle');
    expect(bundleScreen.isBundle).toBe(true);
    expect(bundleScreen.formEntitlements.map((e) => e.kind)).toEqual([
      'featured_ads',
      'ad_slots',
      'shorts',
    ]);
    // Every kind is seeded, so a name is the only thing left to supply.
    bundleScreen.formName = 'All in One 30';
    expect(bundleScreen.formError).toBe('');
  });

  it('refuses an all-in-one with a kind left blank', () => {
    const { component: bundleScreen } = build({ bundleMode: true, superAdmin: true });
    bundleScreen.openCreateForm();
    bundleScreen.formName = 'Partial';
    bundleScreen.formEntitlements[2].quantity = 0;
    expect(bundleScreen.formError).toContain('Shorts');
  });

  it('sends per-kind amounts rather than a single quantity for an all-in-one', () => {
    const { component: bundleScreen, adminService: svc } = build({
      bundleMode: true,
      superAdmin: true,
    });
    bundleScreen.ngOnInit();
    bundleScreen.openCreateForm();
    bundleScreen.formName = 'All in One 90';
    bundleScreen.formDuration = 90;
    bundleScreen.submitCreate();
    expect(svc.createPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 90,
        entitlements: [
          { kind: 'featured_ads', quantity: 3 },
          { kind: 'ad_slots', quantity: 10 },
          { kind: 'shorts', quantity: 5 },
        ],
      }),
    );
    expect(svc.createPackage.mock.calls[0][0]).not.toHaveProperty('quantity');
  });

  it('fills in a kind missing from a stored all-in-one when editing', () => {
    const { component: bundleScreen } = build({ bundleMode: true, superAdmin: true });
    bundleScreen.openEditForm({
      ...mockBundle,
      entitlements: [{ kind: 'ad_slots', quantity: 4 }],
    });
    expect(bundleScreen.formEntitlements).toEqual([
      { kind: 'featured_ads', quantity: 3 },
      { kind: 'ad_slots', quantity: 4 },
      { kind: 'shorts', quantity: 5 },
    ]);
  });

  // --- Super admin restriction ---
  it('lets an ordinary admin manage single-purpose packages', () => {
    expect(component.canManage()).toBe(true);
  });

  it('keeps all-in-one packages read-only for an ordinary admin', () => {
    const { component: bundleScreen, adminService: svc } = build({
      bundleMode: true,
      superAdmin: false,
    });
    bundleScreen.ngOnInit();
    expect(bundleScreen.canManage()).toBe(false);

    bundleScreen.openCreateForm();
    expect(bundleScreen.activePanel).toBe('none');

    bundleScreen.openEditForm(mockBundle);
    expect(bundleScreen.activePanel).toBe('none');

    bundleScreen.askDelete(mockBundle);
    expect(bundleScreen.pendingDelete()).toBeNull();
    expect(svc.deletePackage).not.toHaveBeenCalled();
  });

  // --- Delete ---
  it('deletes a package and reports it', () => {
    component.ngOnInit();
    component.askDelete(mockPackages[0]);
    expect(component.pendingDelete()).toEqual(mockPackages[0]);
    component.confirmDelete();
    expect(adminService.deletePackage).toHaveBeenCalledWith('p1');
    expect(component.pendingDelete()).toBeNull();
    expect(component.notice()).toContain('Deleted');
  });

  it('says a purchased package was deactivated rather than deleted', () => {
    adminService.deletePackage.mockReturnValue(of({ id: 'p1', deleted: false, purchaseCount: 4 }));
    component.ngOnInit();
    component.askDelete(mockPackages[0]);
    component.confirmDelete();
    expect(component.notice()).toContain('deactivated');
    expect(component.notice()).toContain('4');
  });

  it('handles a delete failure', () => {
    adminService.deletePackage.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.askDelete(mockPackages[0]);
    component.confirmDelete();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to delete package.');
  });

  it('cancels a pending delete', () => {
    component.askDelete(mockPackages[0]);
    component.cancelDelete();
    expect(component.pendingDelete()).toBeNull();
    expect(adminService.deletePackage).not.toHaveBeenCalled();
  });
});
