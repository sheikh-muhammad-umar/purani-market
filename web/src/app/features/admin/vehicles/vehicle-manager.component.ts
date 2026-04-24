import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BrandsService,
  VehicleBrand,
  VehicleModel,
  VehicleVariant,
} from '../../../core/services/brands.service';
import { VehicleType } from '../../../core/models/brand.model';
import { CategoriesService } from '../../../core/services/categories.service';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { saveState, loadState } from '../../../core/utils/state-persistence';

type ActiveTab = 'brands' | 'models' | 'variants';

@Component({
  selector: 'app-vehicle-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './vehicle-manager.component.html',
  styleUrl: './vehicle-manager.component.scss',
})
export class VehicleManagerComponent implements OnInit {
  readonly loading = signal(false);
  readonly saving = signal(false);

  // Vehicle type toggle
  vehicleType: VehicleType = 'car';
  categoryMap: Record<VehicleType, string> = { car: '', motorcycle: '' };

  // Brands
  brands = signal<VehicleBrand[]>([]);
  brandSearch = '';
  showAddBrand = false;
  newBrandName = '';
  editingBrandId: string | null = null;
  editBrandName = '';
  private originalBrandName = '';
  deletingBrandId: string | null = null;

  // Brand selection for models/variants
  brandOptions: SelectOption[] = [];
  selectedBrandId = '';
  selectedBrandName = '';

  // Tab
  activeTab: ActiveTab = 'brands';

  setTab(tab: ActiveTab): void {
    this.activeTab = tab;
    saveState('vehicle-manager', { vehicleType: this.vehicleType, activeTab: tab });
  }

  // Models
  models = signal<VehicleModel[]>([]);
  modelSearch = '';
  showAddModel = false;
  newModelName = '';
  editingModelId: string | null = null;
  editModelName = '';
  private originalModelName = '';
  deletingModelId: string | null = null;

  // Variants
  modelOptions: SelectOption[] = [];
  selectedModelId = '';
  selectedModelName = '';
  variants = signal<VehicleVariant[]>([]);
  variantSearch = '';
  showAddVariant = false;
  newVariantName = '';
  editingVariantId: string | null = null;
  editVariantName = '';
  private originalVariantName = '';
  deletingVariantId: string | null = null;

  constructor(
    private readonly brandsService: BrandsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  get currentCategoryId(): string {
    return this.categoryMap[this.vehicleType];
  }

  // ── Category loading (cars & motorcycles only) ──

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        for (const cat of cats) {
          const slug = (cat.slug || '').toLowerCase();
          if (slug === 'cars') this.categoryMap.car = cat._id;
          else if (slug === 'motorcycles') this.categoryMap.motorcycle = cat._id;
        }
        // Fallback: match by name if slug didn't work
        if (!this.categoryMap.car || !this.categoryMap.motorcycle) {
          for (const cat of cats) {
            const name = (cat.name || '').toLowerCase();
            if (!this.categoryMap.car && name === 'cars') this.categoryMap.car = cat._id;
            if (!this.categoryMap.motorcycle && name === 'motorcycles')
              this.categoryMap.motorcycle = cat._id;
          }
        }
        this.switchVehicleType(
          loadState<{ vehicleType: VehicleType }>('vehicle-manager').vehicleType || 'car',
        );
        // Restore tab
        const saved = loadState<{ activeTab: ActiveTab }>('vehicle-manager');
        if (saved.activeTab) this.activeTab = saved.activeTab;
      },
    });
  }

  switchVehicleType(type: VehicleType): void {
    this.vehicleType = type;
    this.activeTab = 'brands';
    this.selectedBrandId = '';
    this.selectedBrandName = '';
    this.selectedModelId = '';
    this.selectedModelName = '';
    this.brands.set([]);
    this.models.set([]);
    this.variants.set([]);
    this.brandSearch = '';
    this.modelSearch = '';
    this.variantSearch = '';
    saveState('vehicle-manager', { vehicleType: type, activeTab: 'brands' });
    this.loadBrands();
  }

  // ── Brands ──

  loadBrands(): void {
    const catId = this.currentCategoryId;
    if (!catId) return;
    this.loading.set(true);
    this.brandsService.getVehicleBrandsByCategory(catId, true).subscribe({
      next: (brands) => {
        this.brands.set(brands);
        this.brandOptions = brands
          .filter((b) => b.isActive)
          .map((b) => ({ value: b._id, label: b.name }));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get filteredBrands(): VehicleBrand[] {
    const q = this.brandSearch.toLowerCase().trim();
    if (!q) return this.brands();
    return this.brands().filter((b) => b.name.toLowerCase().includes(q));
  }

  startAddBrand(): void {
    this.showAddBrand = true;
    this.newBrandName = '';
  }
  cancelAddBrand(): void {
    this.showAddBrand = false;
  }
  saveNewBrand(): void {
    if (!this.newBrandName.trim() || !this.currentCategoryId) return;
    this.saving.set(true);
    this.brandsService
      .createVehicleBrand({
        name: this.newBrandName.trim(),
        categoryId: this.currentCategoryId,
        vehicleType: this.vehicleType,
      })
      .subscribe({
        next: () => {
          this.showAddBrand = false;
          this.saving.set(false);
          this.loadBrands();
        },
        error: () => this.saving.set(false),
      });
  }

  startEditBrand(brand: VehicleBrand): void {
    this.editingBrandId = brand._id;
    this.editBrandName = brand.name;
    this.originalBrandName = brand.name;
  }
  cancelEditBrand(): void {
    this.editingBrandId = null;
  }
  saveEditBrand(): void {
    if (!this.editingBrandId || !this.editBrandName.trim()) return;
    const trimmed = this.editBrandName.trim();
    if (trimmed === this.originalBrandName) {
      this.editingBrandId = null;
      return;
    }
    this.saving.set(true);
    this.brandsService.updateVehicleBrand(this.editingBrandId, { name: trimmed }).subscribe({
      next: () => {
        this.editingBrandId = null;
        this.saving.set(false);
        this.loadBrands();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleBrandActive(brand: VehicleBrand): void {
    this.brandsService
      .updateVehicleBrand(brand._id, { isActive: !brand.isActive })
      .subscribe({ next: () => this.loadBrands() });
  }

  deleteBrand(brand: VehicleBrand): void {
    this.deletingBrandId = brand._id;
  }
  confirmDeleteBrand(): void {
    if (!this.deletingBrandId) return;
    this.brandsService.deleteVehicleBrand(this.deletingBrandId).subscribe({
      next: () => {
        this.deletingBrandId = null;
        this.loadBrands();
      },
    });
  }
  cancelDeleteBrand(): void {
    this.deletingBrandId = null;
  }

  // ── Brand selection for models ──

  selectBrand(brandId: string): void {
    this.selectedBrandId = brandId;
    this.selectedBrandName = this.brandOptions.find((o) => o.value === brandId)?.label || '';
    this.selectedModelId = '';
    this.selectedModelName = '';
    this.variants.set([]);
    this.loadModels();
  }

  // ── Models ──

  loadModels(): void {
    if (!this.selectedBrandId) return;
    this.loading.set(true);
    this.brandsService.getModelsByBrand(this.selectedBrandId, true).subscribe({
      next: (models) => {
        this.models.set(models);
        this.modelOptions = models
          .filter((m) => m.isActive)
          .map((m) => ({ value: m._id, label: m.name }));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get filteredModels(): VehicleModel[] {
    const q = this.modelSearch.toLowerCase().trim();
    if (!q) return this.models();
    return this.models().filter((m) => m.name.toLowerCase().includes(q));
  }

  startAddModel(): void {
    this.showAddModel = true;
    this.newModelName = '';
  }
  cancelAddModel(): void {
    this.showAddModel = false;
  }
  saveNewModel(): void {
    if (!this.newModelName.trim() || !this.selectedBrandId || !this.currentCategoryId) return;
    this.saving.set(true);
    this.brandsService
      .createModel({
        name: this.newModelName.trim(),
        brandId: this.selectedBrandId,
        categoryId: this.currentCategoryId,
        vehicleType: this.vehicleType,
      })
      .subscribe({
        next: () => {
          this.showAddModel = false;
          this.saving.set(false);
          this.loadModels();
        },
        error: () => this.saving.set(false),
      });
  }

  startEditModel(model: VehicleModel): void {
    this.editingModelId = model._id;
    this.editModelName = model.name;
    this.originalModelName = model.name;
  }
  cancelEditModel(): void {
    this.editingModelId = null;
  }
  saveEditModel(): void {
    if (!this.editingModelId || !this.editModelName.trim()) return;
    const trimmed = this.editModelName.trim();
    if (trimmed === this.originalModelName) {
      this.editingModelId = null;
      return;
    }
    this.saving.set(true);
    this.brandsService.updateModel(this.editingModelId, { name: trimmed }).subscribe({
      next: () => {
        this.editingModelId = null;
        this.saving.set(false);
        this.loadModels();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleModelActive(model: VehicleModel): void {
    this.brandsService
      .updateModel(model._id, { isActive: !model.isActive })
      .subscribe({ next: () => this.loadModels() });
  }

  deleteModel(model: VehicleModel): void {
    this.deletingModelId = model._id;
  }
  confirmDeleteModel(): void {
    if (!this.deletingModelId) return;
    this.brandsService.deleteModel(this.deletingModelId).subscribe({
      next: () => {
        this.deletingModelId = null;
        this.loadModels();
      },
    });
  }
  cancelDeleteModel(): void {
    this.deletingModelId = null;
  }

  // ── Variants ──

  selectModel(modelId: string): void {
    this.selectedModelId = modelId;
    this.selectedModelName = this.modelOptions.find((o) => o.value === modelId)?.label || '';
    this.loadVariants();
  }

  loadVariants(): void {
    if (!this.selectedModelId) return;
    this.loading.set(true);
    this.brandsService.getVariantsByModel(this.selectedModelId, true).subscribe({
      next: (variants) => {
        this.variants.set(variants);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get filteredVariants(): VehicleVariant[] {
    const q = this.variantSearch.toLowerCase().trim();
    if (!q) return this.variants();
    return this.variants().filter((v) => v.name.toLowerCase().includes(q));
  }

  startAddVariant(): void {
    this.showAddVariant = true;
    this.newVariantName = '';
  }
  cancelAddVariant(): void {
    this.showAddVariant = false;
  }
  saveNewVariant(): void {
    if (
      !this.newVariantName.trim() ||
      !this.selectedModelId ||
      !this.selectedBrandId ||
      !this.currentCategoryId
    )
      return;
    this.saving.set(true);
    this.brandsService
      .createVariant({
        name: this.newVariantName.trim(),
        modelId: this.selectedModelId,
        brandId: this.selectedBrandId,
        categoryId: this.currentCategoryId,
        vehicleType: this.vehicleType,
      })
      .subscribe({
        next: () => {
          this.showAddVariant = false;
          this.saving.set(false);
          this.loadVariants();
        },
        error: () => this.saving.set(false),
      });
  }

  startEditVariant(variant: VehicleVariant): void {
    this.editingVariantId = variant._id;
    this.editVariantName = variant.name;
    this.originalVariantName = variant.name;
  }
  cancelEditVariant(): void {
    this.editingVariantId = null;
  }
  saveEditVariant(): void {
    if (!this.editingVariantId || !this.editVariantName.trim()) return;
    const trimmed = this.editVariantName.trim();
    if (trimmed === this.originalVariantName) {
      this.editingVariantId = null;
      return;
    }
    this.saving.set(true);
    this.brandsService.updateVariant(this.editingVariantId, { name: trimmed }).subscribe({
      next: () => {
        this.editingVariantId = null;
        this.saving.set(false);
        this.loadVariants();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleVariantActive(variant: VehicleVariant): void {
    this.brandsService
      .updateVariant(variant._id, { isActive: !variant.isActive })
      .subscribe({ next: () => this.loadVariants() });
  }

  deleteVariant(variant: VehicleVariant): void {
    this.deletingVariantId = variant._id;
  }
  confirmDeleteVariant(): void {
    if (!this.deletingVariantId) return;
    this.brandsService.deleteVariant(this.deletingVariantId).subscribe({
      next: () => {
        this.deletingVariantId = null;
        this.loadVariants();
      },
    });
  }
  cancelDeleteVariant(): void {
    this.deletingVariantId = null;
  }
}
