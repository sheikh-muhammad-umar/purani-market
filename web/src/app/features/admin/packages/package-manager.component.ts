import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AdminService,
  CreatePackagePayload,
  UpdatePackagePayload,
} from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AdPackage, EntitlementKind, PackageType } from '../../../core/models';
import { Category } from '../../../core/models/category.model';
import {
  SINGLE_PURPOSE_PACKAGE_TYPE_OPTIONS,
  DURATION_OPTIONS,
  BUNDLE_DURATION_OPTIONS,
  ENTITLEMENT_KIND_OPTIONS,
} from '../../../core/constants/select-options';
import {
  BUNDLE_DEFAULT_QUANTITIES,
  BUNDLE_ENTITLEMENT_KINDS,
  ENTITLEMENT_LABELS,
  PACKAGE_TYPE_LABELS,
} from '../../../core/constants/app';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PackageType as PackageTypeEnum } from '../../../core/constants/enums';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { FormPanel, CategoryPricingGroup, PricingDisplayGroup } from './package-manager.interfaces';

/**
 * Manages ad packages, in one of two modes set by the route.
 *
 * All-in-one packages share this screen because they are rows in the same
 * collection with the same fields; only which packages are listed and which shape
 * the form authors differ. `bundleMode` splits the two so each list shows one kind
 * of product — before this, all-in-one packages were mixed in among the
 * single-purpose ones with nothing but a type badge to tell them apart.
 */
@Component({
  selector: 'app-package-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './package-manager.component.html',
  styleUrls: ['./package-manager.component.scss'],
})
export class PackageManagerComponent implements OnInit {
  readonly PackageTypeEnum = PackageTypeEnum;
  readonly PACKAGE_TYPE_LABELS = PACKAGE_TYPE_LABELS;

  /** Whether this screen is managing all-in-one packages rather than single-purpose ones. */
  readonly bundleMode: boolean;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly saving = signal(false);
  readonly packages = signal<AdPackage[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly pendingDelete = signal<AdPackage | null>(null);

  // Search & filter
  searchQuery = '';
  filterType: PackageType | '' = '';
  filterStatus: 'active' | 'inactive' | '' = '';

  readonly typeFilterOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    ...SINGLE_PURPOSE_PACKAGE_TYPE_OPTIONS,
  ];

  readonly statusFilterOptions: SelectOption[] = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  /** Heading and empty-state wording, so one template serves both modes. */
  get listTitle(): string {
    return this.bundleMode ? 'All in One Packages' : 'Ad Packages';
  }

  get formTitle(): string {
    const what = this.bundleMode ? 'All in One Package' : 'Package';
    return `${this.activePanel === 'create' ? 'Create' : 'Edit'} ${what}`;
  }

  /**
   * Whether the operator may change packages on this screen.
   *
   * All-in-one packages are restricted to super admins server-side. Reflecting that
   * here means an ordinary admin sees the catalogue read-only instead of filling in
   * a form that is rejected on save.
   */
  readonly canManage = computed(() => !this.bundleMode || this.auth.isSuperAdmin());

  get filteredPackages(): AdPackage[] {
    let result = this.packages();

    // Each mode shows only its own kind of product. The API returns every package,
    // so this is what keeps all-in-one packages off the Ad Packages list and vice
    // versa.
    result = result.filter((p) =>
      this.bundleMode ? p.type === PackageTypeEnum.BUNDLE : p.type !== PackageTypeEnum.BUNDLE,
    );

    // Search
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Type filter — every package in bundle mode has the same type, so it is only
    // offered on the single-purpose list.
    if (this.filterType && !this.bundleMode) {
      result = result.filter((p) => p.type === this.filterType);
    }

    // Status filter
    if (this.filterStatus === 'active') {
      result = result.filter((p) => p.isActive);
    } else if (this.filterStatus === 'inactive') {
      result = result.filter((p) => !p.isActive);
    }

    return result;
  }

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
  formDuration = 7;
  formQuantity = 5;
  formDefaultPrice = 500;
  formIsActive = true;
  formCategoryPricing: CategoryPricingGroup[] = [];
  pricingCatSearch: string[] = [];

  /**
   * Per-kind amounts for an all-in-one package.
   *
   * Only sent when the type is `bundle`; a single-purpose package keeps using the
   * flat `formQuantity`, which is what the API has always taken.
   */
  formEntitlements: { kind: EntitlementKind; quantity: number }[] = [];

  readonly typeOptions: SelectOption[] = SINGLE_PURPOSE_PACKAGE_TYPE_OPTIONS;
  readonly entitlementKindOptions: SelectOption[] = ENTITLEMENT_KIND_OPTIONS;
  readonly ENTITLEMENT_LABELS = ENTITLEMENT_LABELS;

  /**
   * The terms this screen sells on.
   *
   * All-in-one packages run to 60 and 90 days because they include shorts; the
   * single-purpose types keep their shorter set, which the server enforces too.
   */
  get durationOptions(): SelectOption[] {
    return this.bundleMode ? BUNDLE_DURATION_OPTIONS : DURATION_OPTIONS;
  }

  /** Whether the form is authoring an all-in-one package. */
  get isBundle(): boolean {
    return this.formType === PackageTypeEnum.BUNDLE;
  }

  /** Explains why the form cannot be submitted, or '' when it can. */
  get formError(): string {
    if (!this.formName.trim()) return 'Give the package a name.';
    if (this.isBundle) {
      // Every kind is required: the server refuses an all-in-one that leaves one
      // out, since a buyer paying for "all in one" would come away short.
      const missing = this.formEntitlements
        .filter((e) => !(e.quantity > 0))
        .map((e) => ENTITLEMENT_LABELS[e.kind] ?? e.kind);
      if (missing.length > 0) {
        return `An all-in-one includes all three. Set an amount for: ${missing.join(', ')}.`;
      }
    } else if (this.formQuantity < 1) {
      return 'Quantity has to be at least 1.';
    }
    return '';
  }

  onTypeChange(type: PackageType): void {
    this.formType = type;
  }

  /** Total across the rows, mirroring what the server stores as `quantity`. */
  get entitlementTotal(): number {
    return this.formEntitlements.reduce((sum, e) => sum + (e.quantity || 0), 0);
  }

  /**
   * What an all-in-one grants, for the list row.
   *
   * The type badge is useless on the all-in-one list — every row reads "All in One"
   * — so the column shows the amounts instead, which is what distinguishes one
   * package from another there.
   */
  includedOf(pkg: AdPackage): { label: string; quantity: number }[] {
    return (pkg.entitlements ?? []).map((e) => ({
      label: ENTITLEMENT_LABELS[e.kind] ?? e.kind,
      quantity: e.quantity,
    }));
  }

  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
    private readonly auth: AuthService,
    route: ActivatedRoute,
  ) {
    this.bundleMode = route.snapshot.data['bundleMode'] === true;
  }

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
    if (!this.canManage()) return;
    this.resetForm();
    this.activePanel = 'create';
  }

  openEditForm(pkg: AdPackage): void {
    if (!this.canManage()) return;
    this.editingPackage = pkg;
    this.formName = pkg.name;
    this.formType = pkg.type;
    this.formDuration = pkg.duration;
    this.formQuantity = pkg.quantity;
    // An all-in-one always edits all three rows, filling in anything the stored
    // package happens to be missing, so the form cannot be saved back incomplete.
    this.formEntitlements = this.bundleMode
      ? this.bundleRows(pkg.entitlements)
      : (pkg.entitlements ?? []).map((e) => ({ ...e }));
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

  // --- Delete ---
  askDelete(pkg: AdPackage): void {
    if (!this.canManage()) return;
    this.pendingDelete.set(pkg);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  /**
   * Withdraws the package held in the confirmation dialog.
   *
   * The server keeps a package that has purchases and deactivates it instead, so
   * paid orders still resolve to the package they name. The outcome is reported
   * rather than assumed, because "deleted" and "deactivated" leave the catalogue
   * looking different.
   */
  confirmDelete(): void {
    const pkg = this.pendingDelete();
    if (!pkg) return;
    this.saving.set(true);
    this.notice.set(null);
    this.adminService.deletePackage(pkg._id).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.pendingDelete.set(null);
        this.notice.set(
          result.deleted
            ? `Deleted "${pkg.name}".`
            : `"${pkg.name}" has ${result.purchaseCount} purchase(s), so it was deactivated instead of deleted. Existing orders keep working; it is no longer offered.`,
        );
        if (this.editingPackage?._id === pkg._id) this.cancelForm();
        this.loadPackages();
      },
      error: () => {
        this.saving.set(false);
        this.pendingDelete.set(null);
        this.error.set(ERROR_MSG.PACKAGE_DELETE_FAILED);
      },
    });
  }

  submitCreate(): void {
    if (this.formError || !this.canManage()) return;
    const payload: CreatePackagePayload = {
      name: this.formName.trim(),
      duration: this.formDuration,
      defaultPrice: this.formDefaultPrice,
      isActive: this.formIsActive,
      ...this.entitlementPayload(),
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
    if (!this.editingPackage || this.formError || !this.canManage()) return;
    const payload: UpdatePackagePayload = {
      name: this.formName.trim(),
      duration: this.formDuration,
      defaultPrice: this.formDefaultPrice,
      isActive: this.formIsActive,
      categoryPricing: this.flattenCategoryPricing(this.formCategoryPricing),
      ...this.entitlementPayload(),
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

  /**
   * The half of the payload describing what the package grants.
   *
   * A bundle sends `entitlements` and lets the server derive `type` and
   * `quantity`; anything else keeps sending the pair the API has always taken.
   */
  private entitlementPayload(): Partial<CreatePackagePayload> {
    if (this.isBundle) {
      return {
        entitlements: this.formEntitlements
          .filter((e) => e.quantity > 0)
          .map((e) => ({ kind: e.kind, quantity: Number(e.quantity) })),
      };
    }
    return { type: this.formType, quantity: this.formQuantity };
  }

  /**
   * The three rows an all-in-one is authored through, in a fixed order.
   *
   * Always all three, because the server refuses a partial one. Existing amounts
   * are kept so editing a package does not silently reprice what it grants.
   */
  private bundleRows(
    existing: { kind: EntitlementKind; quantity: number }[] = [],
  ): { kind: EntitlementKind; quantity: number }[] {
    return BUNDLE_ENTITLEMENT_KINDS.map((kind) => ({
      kind: kind as EntitlementKind,
      quantity:
        existing.find((e) => e.kind === kind)?.quantity ?? BUNDLE_DEFAULT_QUANTITIES[kind] ?? 1,
    }));
  }

  private resetForm(): void {
    this.editingPackage = null;
    this.formName = '';
    this.formType = this.bundleMode ? PackageTypeEnum.BUNDLE : PackageTypeEnum.FEATURED_ADS;
    this.formDuration = 7;
    this.formQuantity = 5;
    this.formDefaultPrice = this.bundleMode ? 1800 : 500;
    this.formIsActive = true;
    this.formCategoryPricing = [];
    this.formEntitlements = this.bundleMode ? this.bundleRows() : [];
    this.pricingCatSearch = [];
  }
}
