import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  CreatePackagePayload,
  UpdatePackagePayload,
} from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AdPackage, PackageType } from '../../../core/models';
import { Category } from '../../../core/models/category.model';
import { PACKAGE_TYPE_OPTIONS, DURATION_OPTIONS } from '../../../core/constants/select-options';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { PackageType as PackageTypeEnum } from '../../../core/constants/enums';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { FormPanel, CategoryPricingGroup, PricingDisplayGroup } from './package-manager.interfaces';

/** Display labels for package types used in template */
const PACKAGE_TYPE_LABELS: Record<string, string> = {
  [PackageTypeEnum.FEATURED_ADS]: 'Featured',
  [PackageTypeEnum.AD_SLOTS]: 'Ad Slots',
};

@Component({
  selector: 'app-package-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './package-manager.component.html',
  styleUrls: ['./package-manager.component.scss'],
})
export class PackageManagerComponent implements OnInit {
  readonly PackageTypeEnum = PackageTypeEnum;
  readonly PACKAGE_TYPE_LABELS = PACKAGE_TYPE_LABELS;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly packages = signal<AdPackage[]>([]);
  readonly categories = signal<Category[]>([]);

  // Sorting as signals for reactive template binding
  readonly pkgSortCol = signal('');
  readonly pkgSortDir = signal<'asc' | 'desc'>('asc');

  readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Select category' },
    ...this.categories().map((c) => ({ value: c._id, label: c.name })),
  ]);

  /** Map of categoryId → name for O(1) lookups in template */
  readonly categoryNameMap = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const c of this.categories()) {
      map.set(c._id, c.name);
    }
    return map;
  });

  activePanel: FormPanel = 'none';
  editingPackage: AdPackage | null = null;
  expandedPackageIds = new Set<string>();

  // Form fields
  formName = '';
  formType: PackageType = PackageTypeEnum.FEATURED_ADS;
  formDuration: 7 | 15 | 30 = 7;
  formQuantity = 5;
  formDefaultPrice = 500;
  formIsActive = true;
  formCategoryPricing: CategoryPricingGroup[] = [];
  pricingCatSearch: string[] = [];

  readonly typeOptions: SelectOption[] = PACKAGE_TYPE_OPTIONS;
  readonly durationOptions: SelectOption[] = DURATION_OPTIONS;

  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
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
        this.error.set(ERROR_MSG.PACKAGES_LOAD_FAILED);
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

  openCreateForm(): void {
    this.resetForm();
    this.activePanel = 'create';
  }

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
      payload.categoryPricing = this.flattenCategoryPricing(this.formCategoryPricing);
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
        this.error.set(ERROR_MSG.PACKAGE_CREATE_FAILED);
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
      categoryPricing: this.flattenCategoryPricing(this.formCategoryPricing),
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
        this.error.set(ERROR_MSG.PACKAGE_UPDATE_FAILED);
      },
    });
  }

  // --- Category Pricing ---
  addCategoryPrice(): void {
    this.formCategoryPricing = [...this.formCategoryPricing, { categoryIds: [], price: 0 }];
    this.pricingCatSearch = [...this.pricingCatSearch, ''];
  }

  removeCategoryPrice(index: number): void {
    this.formCategoryPricing = this.formCategoryPricing.filter(
      (_: CategoryPricingGroup, i: number) => i !== index,
    );
    this.pricingCatSearch = this.pricingCatSearch.filter((_: string, i: number) => i !== index);
  }

  togglePricingCategory(row: CategoryPricingGroup, catId: string): void {
    const idx = row.categoryIds.indexOf(catId);
    if (idx >= 0) {
      row.categoryIds = row.categoryIds.filter((id: string) => id !== catId);
    } else {
      row.categoryIds = [...row.categoryIds, catId];
    }
  }

  getCategoryName(catId: string): string {
    return this.categoryNameMap().get(catId) ?? catId;
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

  getGroupedPricing(pkg: AdPackage): PricingDisplayGroup[] {
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

  filteredCategoriesForRow(index: number): Category[] {
    const q = (this.pricingCatSearch[index] || '').toLowerCase().trim();
    if (!q) return this.categories();
    return this.categories().filter((c) => c.name.toLowerCase().includes(q));
  }

  trackByIndex(index: number): number {
    return index;
  }

  sortPackages(col: string): void {
    if (this.pkgSortCol() === col) {
      this.pkgSortDir.set(this.pkgSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.pkgSortCol.set(col);
      this.pkgSortDir.set('asc');
    }
    const dir = this.pkgSortDir() === 'asc' ? 1 : -1;
    this.packages.update((pkgs) =>
      [...pkgs].sort((a: any, b: any) => {
        const va = a[col];
        const vb = b[col];
        if (typeof va === 'string') return va.localeCompare(vb) * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  getSortIcon(col: string): string {
    if (col !== this.pkgSortCol()) return 'unfold_more';
    return this.pkgSortDir() === 'asc' ? 'expand_less' : 'expand_more';
  }

  private flattenCategoryPricing(
    groups: CategoryPricingGroup[],
  ): { categoryId: string; price: number }[] {
    return groups
      .flatMap((cp) =>
        cp.categoryIds
          .filter((id: string) => id)
          .map((id: string) => ({ categoryId: id, price: cp.price })),
      )
      .filter((cp) => cp.price > 0);
  }

  private groupCategoryPricing(
    flat: { categoryId: string; price: number }[],
  ): CategoryPricingGroup[] {
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
