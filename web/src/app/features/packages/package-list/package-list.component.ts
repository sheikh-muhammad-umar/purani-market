import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PackagesService } from '../../../core/services/packages.service';
import { AdPackage, PackageType } from '../../../core/models';
import { CURRENCY_SYMBOL, PACKAGE_TYPE_LABELS } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { PackageType as PackageTypeEnum } from '../../../core/constants/enums';

@Component({
  selector: 'app-package-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './package-list.component.html',
  styleUrls: ['./package-list.component.scss'],
})
export class PackageListComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly packages = signal<AdPackage[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedType = signal<PackageType | 'all'>('all');
  readonly selectedDuration = signal<7 | 15 | 30 | null>(null);

  constructor(private readonly packagesService: PackagesService) {}

  ngOnInit(): void {
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading.set(true);
    this.error.set(null);
    this.packagesService.getAll().subscribe({
      next: (res: any) => {
        const packages = Array.isArray(res) ? res : (res.data ?? []);
        this.packages.set(packages);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load packages. Please try again.');
        this.loading.set(false);
      },
    });
  }

  filteredPackages(): AdPackage[] {
    let result = this.packages();
    const type = this.selectedType();
    const duration = this.selectedDuration();
    if (type !== 'all') {
      result = result.filter((p) => p.type === type);
    }
    if (duration !== null) {
      result = result.filter((p) => p.duration === duration);
    }
    return result;
  }

  setType(type: PackageType | 'all'): void {
    this.selectedType.set(type);
  }

  setDuration(duration: 7 | 15 | 30 | null): void {
    this.selectedDuration.set(duration);
  }

  formatPrice(price: number): string {
    return `${CURRENCY_SYMBOL} ${price.toLocaleString()}`;
  }

  getTypeLabel(type: PackageType): string {
    return PACKAGE_TYPE_LABELS[type] ?? type;
  }

  getTypeIcon(type: PackageType): string {
    return type === PackageTypeEnum.FEATURED_ADS ? 'star' : 'inventory_2';
  }

  getDurationLabel(duration: number): string {
    return `${duration} days`;
  }
}
