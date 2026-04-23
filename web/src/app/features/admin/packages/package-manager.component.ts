import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  CreatePackagePayload,
  UpdatePackagePayload,
  AdminPurchasesParams,
} from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import {
  AdPackage,
  PackagePurchase,
  PackageType,
  PaymentStatus,
  CategoryPricing,
} from '../../../core/models';
import { Category } from '../../../core/models/category.model';
import {
  PACKAGE_TYPE_OPTIONS,
  PACKAGE_TYPE_FILTER_OPTIONS,
  DURATION_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../../../core/constants/select-options';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { PackageType as PackageTypeEnum } from '../../../core/constants/enums';

@Component({
  selector: 'app-package-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, DatePickerComponent],
  templateUrl: './package-manager.component.html',
  styleUrls: ['./package-manager.component.scss'],
})
export class PackageManagerComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly packages = signal<AdPackage[]>([]);
  readonly purchases = signal<PackagePurchase[]>([]);
  readonly purchasesTotal = signal(0);
  readonly categories = signal<Category[]>([]);

  // Sorting
  pkgSortCol = '';
  pkgSortDir: 'asc' | 'desc' = 'asc';

  readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Select category' },
    ...this.categories().map((c) => ({ value: c._id, label: c.name })),
  ]);

  activeTab: 'packages' | 'purchases' = 'packages';
  activePanel: 'none' | 'create' | 'edit' = 'none';
  editingPackage: AdPackage | null = null;
  expandedPackageIds = new Set<string>();

  // Form fields
  formName = '';
  formType: PackageType = PackageTypeEnum.FEATURED_ADS;
  formDuration: 7 | 15 | 30 = 7;
  formQuantity = 5;
  formDefaultPrice = 500;
  formIsActive = true;
  formCategoryPricing: { categoryIds: string[]; price: number }[] = [];
  pricingCatSearch: string[] = [];

  // Purchase filters
  purchaseFilterStartDate = '';
  purchaseFilterEndDate = '';
  purchaseFilterSellerId = '';
  purchaseFilterType: PackageType | '' = '';
  purchaseFilterStatus: PaymentStatus | '' = '';

  readonly typeOptions: SelectOption[] = PACKAGE_TYPE_OPTIONS;

  readonly durationOptions: SelectOption[] = DURATION_OPTIONS;

  readonly purchaseTypeOptions: SelectOption[] = PACKAGE_TYPE_FILTER_OPTIONS;

  readonly purchaseStatusOptions: SelectOption[] = PAYMENT_STATUS_OPTIONS;
  purchasePage = 1;
  readonly purchaseLimit = 10;

  constructor(
    readonly adminService: AdminService,
    readonly categoriesService: CategoriesService,
  ) {}

  ngOnInit(): void {
    this.loadPackages();
    this.loadCategories();
  }

  loadPackages(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService.getAdminPackages().subscribe({
      next: (res: any) => {
        const unwrapped = res && res.data && res.statusCode ? res.data : res;
        this.packages.set(unwrapped.data ?? unwrapped ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load packages.');
        this.loading.set(false);
      },
    });
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadPurchases(): void {
    this.loading.set(true);
    const params: AdminPurchasesParams = {
      page: this.purchasePage,
      limit: this.purchaseLimit,
    };
    if (this.purchaseFilterStartDate) params.startDate = this.purchaseFilterStartDate;
    if (this.purchaseFilterEndDate) params.endDate = this.purchaseFilterEndDate;
    if (this.purchaseFilterSellerId) params.sellerId = this.purchaseFilterSellerId;
    if (this.purchaseFilterType) params.type = this.purchaseFilterType;
    if (this.purchaseFilterStatus) params.status = this.purchaseFilterStatus;

    this.adminService.getAdminPurchases(params).subscribe({
      next: (res: any) => {
        const unwrapped = res && res.data && res.statusCode ? res.data : res;
        this.purchases.set(unwrapped.data ?? unwrapped ?? []);
        this.purchasesTotal.set(unwrapped.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load purchases.');
        this.loading.set(false);
      },
    });
  }

  switchTab(tab: 'packages' | 'purchases'): void {
    this.activeTab = tab;
    this.activePanel = 'none';
    if (tab === 'purchases') {
      this.loadPurchases();
    }
  }

  // --- Create ---
  openCreateForm(): void {
    this.resetForm();
    this.activePanel = 'create';
  }

  // --- Edit ---
  openEditForm(pkg: AdPackage): void {
    this.editingPackage = pkg;
    this.formName = pkg.name;
    this.formType = pkg.type;
    this.formDuration = pkg.duration;
    this.formQuantity = pkg.quantity;
    this.formDefaultPrice = pkg.defaultPrice;
    this.formIsActive = pkg.isActive;
    this.formCategoryPricing = pkg.categoryPricing
      ? this.groupCategoryPricing(pkg.categoryPricing)
      : [];
    this.pricingCatSearch = this.formCategoryPricing.map(() => '');
    this.activePanel = 'edit';
  }

  cancelForm(): void {
    this.activePanel = 'none';
    this.editingPackage = null;
  }

  submitCreate(): void {
    if (!this.formName.trim()) return;
    const payload: CreatePackagePayload = {
      name: this.formName.trim(),
      type: this.formType,
      duration: this.formDuration,
      quantity: this.formQuantity,
      defaultPrice: this.formDefaultPrice,
      isActive: this.formIsActive,
    };
    if (this.formCategoryPricing.length > 0) {
      payload.categoryPricing = this.formCategoryPricing
        .flatMap((cp) =>
          cp.categoryIds.filter((id) => id).map((id) => ({ categoryId: id, price: cp.price })),
        )
        .filter((cp) => cp.price > 0);
    }
    this.saving.set(true);
    this.adminService.createPackage(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadPackages();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to create package.');
      },
    });
  }

  submitEdit(): void {
    if (!this.editingPackage || !this.formName.trim()) return;
    const payload: UpdatePackagePayload = {
      name: this.formName.trim(),
      type: this.formType,
      duration: this.formDuration,
      quantity: this.formQuantity,
      defaultPrice: this.formDefaultPrice,
      isActive: this.formIsActive,
      categoryPricing: this.formCategoryPricing
        .flatMap((cp) =>
          cp.categoryIds.filter((id) => id).map((id) => ({ categoryId: id, price: cp.price })),
        )
        .filter((cp) => cp.price > 0),
    };
    this.saving.set(true);
    this.adminService.updatePackage(this.editingPackage._id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.editingPackage = null;
        this.loadPackages();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to update package.');
      },
    });
  }

  // --- Category Pricing ---
  addCategoryPrice(): void {
    this.formCategoryPricing.push({ categoryIds: [], price: 0 });
    this.pricingCatSearch.push('');
  }

  removeCategoryPrice(index: number): void {
    this.formCategoryPricing.splice(index, 1);
    this.pricingCatSearch.splice(index, 1);
  }

  togglePricingCategory(row: { categoryIds: string[]; price: number }, catId: string): void {
    const idx = row.categoryIds.indexOf(catId);
    if (idx >= 0) {
      row.categoryIds.splice(idx, 1);
    } else {
      row.categoryIds.push(catId);
    }
  }

  getCategoryName(catId: string): string {
    return this.categories().find((c) => c._id === catId)?.name ?? catId;
  }

  togglePackageExpand(pkgId: string): void {
    if (this.expandedPackageIds.has(pkgId)) {
      this.expandedPackageIds.delete(pkgId);
    } else {
      this.expandedPackageIds.add(pkgId);
    }
  }

  isPackageExpanded(pkgId: string): boolean {
    return this.expandedPackageIds.has(pkgId);
  }

  getGroupedPricing(pkg: any): { price: number; categories: string[] }[] {
    if (!pkg.categoryPricing?.length) return [];
    const groups = new Map<number, string[]>();
    for (const cp of pkg.categoryPricing) {
      const existing = groups.get(cp.price);
      if (existing) {
        existing.push(cp.categoryId);
      } else {
        groups.set(cp.price, [cp.categoryId]);
      }
    }
    return Array.from(groups.entries()).map(([price, cats]) => ({
      price,
      categories: cats,
    }));
  }

  private groupCategoryPricing(
    flat: { categoryId: string; price: number }[],
  ): { categoryIds: string[]; price: number }[] {
    const groups = new Map<number, string[]>();
    for (const cp of flat) {
      const existing = groups.get(cp.price);
      if (existing) {
        existing.push(cp.categoryId);
      } else {
        groups.set(cp.price, [cp.categoryId]);
      }
    }
    return Array.from(groups.entries()).map(([price, categoryIds]) => ({ categoryIds, price }));
  }

  filteredCategoriesForRow(index: number): Category[] {
    const q = (this.pricingCatSearch[index] || '').toLowerCase().trim();
    if (!q) return this.categories();
    return this.categories().filter((c) => c.name.toLowerCase().includes(q));
  }

  // --- Purchase Filters ---
  applyPurchaseFilters(): void {
    this.purchasePage = 1;
    this.loadPurchases();
  }

  resetPurchaseFilters(): void {
    this.purchaseFilterStartDate = '';
    this.purchaseFilterEndDate = '';
    this.purchaseFilterSellerId = '';
    this.purchaseFilterType = '';
    this.purchaseFilterStatus = '';
    this.purchasePage = 1;
    this.loadPurchases();
  }

  nextPurchasePage(): void {
    this.purchasePage++;
    this.loadPurchases();
  }

  prevPurchasePage(): void {
    if (this.purchasePage > 1) {
      this.purchasePage--;
      this.loadPurchases();
    }
  }

  get totalPurchasePages(): number {
    return Math.ceil(this.purchasesTotal() / this.purchaseLimit) || 1;
  }

  trackByIndex(index: number): number {
    return index;
  }

  sortPackages(col: string): void {
    if (this.pkgSortCol === col) {
      this.pkgSortDir = this.pkgSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.pkgSortCol = col;
      this.pkgSortDir = 'asc';
    }
    const dir = this.pkgSortDir === 'asc' ? 1 : -1;
    this.packages.update((pkgs) =>
      [...pkgs].sort((a: any, b: any) => {
        const va = a[col];
        const vb = b[col];
        if (typeof va === 'string') return va.localeCompare(vb) * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  sortIcon(col: string, currentCol: string, currentDir: string): string {
    if (col !== currentCol) return 'unfold_more';
    return currentDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  private resetForm(): void {
    this.editingPackage = null;
    this.formName = '';
    this.formType = PackageTypeEnum.FEATURED_ADS;
    this.formDuration = 7;
    this.formQuantity = 5;
    this.formDefaultPrice = 500;
    this.formIsActive = true;
    this.formCategoryPricing = [];
    this.pricingCatSearch = [];
  }
}
