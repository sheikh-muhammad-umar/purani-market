import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandsService, Brand } from '../../../core/services/brands.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-brand-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './brand-manager.component.html',
  styleUrl: './brand-manager.component.scss',
})
export class BrandManagerComponent implements OnInit {
  readonly loading = signal(false);
  readonly brands = signal<Brand[]>([]);
  readonly saving = signal(false);

  // Category selection (required first step)
  selectedCategoryId = '';
  selectedCategoryName = '';
  categoryOptions: SelectOption[] = [];

  // Search
  searchQuery = '';

  // Add
  showAddForm = false;
  newName = '';

  // Edit
  editingId: string | null = null;
  editName = '';

  // Delete
  deletingId: string | null = null;

  constructor(
    private readonly brandsService: BrandsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        const brandCats = cats.filter((c) => c.hasBrands === true);
        this.categoryOptions = brandCats.map((c) => ({ value: c._id, label: c.name }));
        // Auto-select first if only one
        if (this.categoryOptions.length === 1) {
          this.selectCategory(this.categoryOptions[0].value as string);
        }
      },
    });
  }

  selectCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
    const opt = this.categoryOptions.find((o) => o.value === categoryId);
    this.selectedCategoryName = opt?.label || '';
    this.searchQuery = '';
    this.loadBrands();
  }

  loadBrands(): void {
    if (!this.selectedCategoryId) return;
    this.loading.set(true);
    this.brandsService.getByCategory(this.selectedCategoryId).subscribe({
      next: (brands) => {
        this.brands.set(brands);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  get filteredBrands(): Brand[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.brands();
    return this.brands().filter((b) => b.name.toLowerCase().includes(q));
  }

  get brandCount(): number {
    return this.brands().length;
  }

  // Add
  startAdd(): void {
    this.showAddForm = true;
    this.newName = '';
  }
  cancelAdd(): void {
    this.showAddForm = false;
  }
  saveNew(): void {
    if (!this.newName.trim() || !this.selectedCategoryId) return;
    this.saving.set(true);
    this.brandsService
      .create({ name: this.newName.trim(), categoryId: this.selectedCategoryId })
      .subscribe({
        next: () => {
          this.showAddForm = false;
          this.saving.set(false);
          this.loadBrands();
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  // Edit
  startEdit(brand: Brand): void {
    this.editingId = brand._id;
    this.editName = brand.name;
  }
  cancelEdit(): void {
    this.editingId = null;
  }
  saveEdit(): void {
    if (!this.editingId || !this.editName.trim()) return;
    this.saving.set(true);
    this.brandsService.update(this.editingId, { name: this.editName.trim() }).subscribe({
      next: () => {
        this.editingId = null;
        this.saving.set(false);
        this.loadBrands();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  // Toggle
  toggleActive(brand: Brand): void {
    this.brandsService
      .update(brand._id, { isActive: !brand.isActive })
      .subscribe({ next: () => this.loadBrands() });
  }

  // Delete
  deleteBrand(brand: Brand): void {
    this.deletingId = brand._id;
  }
  confirmDelete(): void {
    if (!this.deletingId) return;
    this.brandsService.delete(this.deletingId).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadBrands();
      },
    });
  }
  cancelDelete(): void {
    this.deletingId = null;
  }
}
