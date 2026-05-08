import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';
import { PackagesService } from '../../../core/services/packages.service';
import { ShortsService, ShortsPackage } from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { AdPackage, PackageType, Category } from '../../../core/models';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { CURRENCY_SYMBOL, PACKAGE_TYPE_LABELS } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { PackageType as PackageTypeEnum, TAB, TabType } from '../../../core/constants/enums';

@Component({
  selector: 'app-package-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CustomSelectComponent],
  templateUrl: './package-list.component.html',
  styleUrls: ['./package-list.component.scss'],
})
export class PackageListComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly TAB = TAB;
  readonly activeTab = signal<TabType>(TAB.ADS);
  readonly packages = signal<AdPackage[]>([]);
  readonly shortsPackages = signal<ShortsPackage[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly loadingShorts = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedType = signal<PackageType | 'all'>('all');
  readonly selectedDuration = signal<7 | 15 | 30 | null>(null);
  readonly selectedCategoryId = signal<string | null>(null);

  readonly categoryFilterOptions = computed(() => [
    { value: '', label: 'All Categories' },
    ...this.categories().map((c) => ({ value: c._id, label: c.name })),
  ]);

  constructor(
    private readonly packagesService: PackagesService,
    private readonly shortsService: ShortsService,
    private readonly categoriesService: CategoriesService,
    private readonly tracker: ActivityTrackerService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Check query param for tab
    const tab = this.route.snapshot.queryParams['tab'];
    if (tab === TAB.SHORTS) {
      this.activeTab.set(TAB.SHORTS);
      this.loadShortsPackages();
    }

    this.loadPackages();
    this.loadCategories();
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
    if (tab === TAB.SHORTS && this.shortsPackages().length === 0) {
      this.loadShortsPackages();
    }
  }

  loadShortsPackages(): void {
    this.loadingShorts.set(true);
    this.shortsService.getAvailablePackages().subscribe({
      next: (pkgs) => {
        this.shortsPackages.set(pkgs);
        this.loadingShorts.set(false);
      },
      error: () => this.loadingShorts.set(false),
    });
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

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => {}, // silently fail — categories are optional enhancement
    });
  }

  /** Filtered packages — recomputed only when packages, type, or duration signals change. */
  readonly filteredPackages = computed(() => {
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
  });

  setType(type: PackageType | 'all'): void {
    this.selectedType.set(type);
  }

  setDuration(duration: 7 | 15 | 30 | null): void {
    this.selectedDuration.set(duration);
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId || null);
  }

  resolvePrice(pkg: AdPackage): number {
    const categoryId = this.selectedCategoryId();
    if (categoryId && pkg.categoryPricing?.length) {
      const match = pkg.categoryPricing.find((cp) => cp.categoryId === categoryId);
      if (match) {
        return match.price;
      }
    }
    return pkg.defaultPrice;
  }

  isCategoryPrice(pkg: AdPackage): boolean {
    const categoryId = this.selectedCategoryId();
    if (categoryId && pkg.categoryPricing?.length) {
      return pkg.categoryPricing.some((cp) => cp.categoryId === categoryId);
    }
    return false;
  }

  onPurchaseClick(pkg: AdPackage): void {
    const categoryId = this.selectedCategoryId();
    if (categoryId) {
      this.tracker.track(TrackingEvent.PACKAGE_PURCHASE_INITIATED, {
        metadata: {
          packageId: pkg._id,
          categoryId,
          packageType: pkg.type,
          price: this.resolvePrice(pkg),
        },
      });
    }
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
