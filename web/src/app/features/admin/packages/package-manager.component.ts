import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  CreatePackagePayload,
  UpdatePackagePayload,
  AdminPurchasesParams,
} from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AdPackage, PackagePurchase, PackageType, PaymentStatus, CategoryPricing } from '../../../core/models';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-package-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  activeTab: 'packages' | 'purchases' = 'packages';
  activePanel: 'none' | 'create' | 'edit' = 'none';
  editingPackage: AdPackage | null = null;

  // Form fields
  formName = '';
  formType: PackageType = 'featured_ads';
  formDuration: 7 | 15 | 30 = 7;
  formQuantity = 5;
  formDefaultPrice = 500;
  formIsActive = true;
  formCategoryPricing: { categoryId: string; price: number }[] = [];

  // Purchase filters
  purchaseFilterStartDate = '';
  purchaseFilterEndDate = '';
  purchaseFilterSellerId = '';
  purchaseFilterType: PackageType | '' = '';
  purchaseFilterStatus: PaymentStatus | '' = '';
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
      next: (res) => {
        this.packages.set(res.data);
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
      next: (res) => {
        this.purchases.set(res.data);
        this.purchasesTotal.set(res.total);
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
      ? pkg.categoryPricing.map(cp => ({ ...cp }))
      : [];
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
      payload.categoryPricing = this.formCategoryPricing.filter(cp => cp.categoryId && cp.price > 0);
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
      categoryPricing: this.formCategoryPricing.filter(cp => cp.categoryId && cp.price > 0),
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
    this.formCategoryPricing.push({ categoryId: '', price: 0 });
  }

  removeCategoryPrice(index: number): void {
    this.formCategoryPricing.splice(index, 1);
  }

  getCategoryName(id: string): string {
    return this.categories().find(c => c._id === id)?.name ?? id;
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

  private resetForm(): void {
    this.editingPackage = null;
    this.formName = '';
    this.formType = 'featured_ads';
    this.formDuration = 7;
    this.formQuantity = 5;
    this.formDefaultPrice = 500;
    this.formIsActive = true;
    this.formCategoryPricing = [];
  }
}
