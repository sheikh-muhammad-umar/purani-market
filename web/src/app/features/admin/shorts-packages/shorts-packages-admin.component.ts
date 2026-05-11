import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShortsService, ShortsPackage } from '../../../core/services/shorts.service';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { SHORTS_DURATION_OPTIONS } from '../../../core/constants/select-options';

@Component({
  selector: 'app-shorts-packages-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shorts-packages-admin.component.html',
  styleUrls: ['./shorts-packages-admin.component.scss'],
})
export class ShortsPackagesAdminComponent implements OnInit {
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly shortsDurationOptions = SHORTS_DURATION_OPTIONS;
  readonly packages = signal<ShortsPackage[]>([]);
  readonly loading = signal(true);
  readonly showCreatePackage = signal(false);
  readonly editingPackage = signal<ShortsPackage | null>(null);

  pkgForm = {
    name: '',
    quantity: 5,
    duration: 30,
    price: 500,
    description: '',
  };

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

  editPackage(pkg: ShortsPackage): void {
    this.editingPackage.set(pkg);
    this.pkgForm = {
      name: pkg.name,
      quantity: pkg.quantity,
      duration: pkg.duration,
      price: pkg.price,
      description: pkg.description || '',
    };
  }

  closePackageModal(): void {
    this.showCreatePackage.set(false);
    this.editingPackage.set(null);
    this.pkgForm = {
      name: '',
      quantity: 5,
      duration: 30,
      price: 500,
      description: '',
    };
  }

  savePackage(): void {
    const editing = this.editingPackage();
    if (editing) {
      this.shortsService.adminUpdatePackage(editing._id, this.pkgForm).subscribe({
        next: () => {
          this.loadPackages();
          this.closePackageModal();
        },
      });
    } else {
      this.shortsService.adminCreatePackage(this.pkgForm).subscribe({
        next: () => {
          this.loadPackages();
          this.closePackageModal();
        },
      });
    }
  }

  togglePackageStatus(pkg: ShortsPackage): void {
    this.shortsService.adminUpdatePackage(pkg._id, { isActive: !pkg.isActive }).subscribe({
      next: () => this.loadPackages(),
    });
  }
}
