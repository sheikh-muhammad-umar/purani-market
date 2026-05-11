import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShortsService, ShortsPackage } from '../../../core/services/shorts.service';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { SHORTS_DURATION_OPTIONS } from '../../../core/constants/select-options';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';

type FormPanel = 'none' | 'create' | 'edit';

@Component({
  selector: 'app-shorts-packages-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './shorts-packages-admin.component.html',
  styleUrls: ['./shorts-packages-admin.component.scss'],
})
export class ShortsPackagesAdminComponent implements OnInit {
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly shortsDurationOptions = SHORTS_DURATION_OPTIONS;
  readonly packages = signal<ShortsPackage[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);

  // Search & filter
  searchQuery = '';
  filterStatus: 'active' | 'inactive' | '' = '';

  // Sort
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // Form panel
  activePanel: FormPanel = 'none';
  editingPackage: ShortsPackage | null = null;

  pkgForm = {
    name: '',
    quantity: 5,
    duration: 30,
    price: 500,
    description: '',
  };

  readonly statusFilterOptions: SelectOption[] = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  get filteredPackages(): ShortsPackage[] {
    let result = this.packages();

    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (this.filterStatus === 'active') {
      result = result.filter((p) => p.isActive);
    } else if (this.filterStatus === 'inactive') {
      result = result.filter((p) => !p.isActive);
    }

    return result;
  }

  constructor(private readonly shortsService: ShortsService) {}

  ngOnInit(): void {
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading.set(true);
    this.shortsService.adminGetPackages().subscribe({
      next: (pkgs) => {
        this.packages.set(pkgs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // --- Sort ---
  sortPackages(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.packages.update((pkgs) =>
      [...pkgs].sort((a: any, b: any) => {
        const va = a[col];
        const vb = b[col];
        if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  getSortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  // --- Create/Edit ---
  openCreateForm(): void {
    this.resetForm();
    this.activePanel = 'create';
  }

  openEditForm(pkg: ShortsPackage): void {
    this.editingPackage = pkg;
    this.pkgForm = {
      name: pkg.name,
      quantity: pkg.quantity,
      duration: pkg.duration,
      price: pkg.price,
      description: pkg.description || '',
    };
    this.activePanel = 'edit';
  }

  cancelForm(): void {
    this.activePanel = 'none';
    this.editingPackage = null;
  }

  submitCreate(): void {
    if (!this.pkgForm.name.trim()) return;
    this.saving.set(true);
    this.shortsService.adminCreatePackage(this.pkgForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.loadPackages();
      },
      error: () => this.saving.set(false),
    });
  }

  submitEdit(): void {
    if (!this.editingPackage || !this.pkgForm.name.trim()) return;
    this.saving.set(true);
    this.shortsService.adminUpdatePackage(this.editingPackage._id, this.pkgForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.activePanel = 'none';
        this.editingPackage = null;
        this.loadPackages();
      },
      error: () => this.saving.set(false),
    });
  }

  togglePackageStatus(pkg: ShortsPackage): void {
    this.shortsService.adminUpdatePackage(pkg._id, { isActive: !pkg.isActive }).subscribe({
      next: () => this.loadPackages(),
    });
  }

  private resetForm(): void {
    this.editingPackage = null;
    this.pkgForm = {
      name: '',
      quantity: 5,
      duration: 30,
      price: 500,
      description: '',
    };
  }
}
