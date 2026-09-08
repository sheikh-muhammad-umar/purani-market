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
import {
  CURRENCY_SYMBOL,
  PACKAGE_TYPE_LABELS,
  PACKAGE_TYPE_ICONS,
  ENTITLEMENT_LABELS,
  ENTITLEMENT_ICONS,
} from '../../../core/constants/app';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { ROUTES } from '../../../core/constants/routes';
import { PackageType as PackageTypeEnum, TAB, TabType } from '../../../core/constants/enums';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-package-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CustomSelectComponent, EmptyStateComponent, SkeletonComponent],
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
  readonly selectedDuration = signal<number | null>(null);
  readonly selectedCategoryId = signal<string | null>(null);

  /**
   * The terms shown as chips, which differ per tab.
   *
   * All-in-one packages are sold on longer terms than single-purpose ad packages
   * because they include shorts, so a shared chip row would offer 60 and 90 days
   * on the Ads tab where nothing matches them.
   */
  readonly durationChips = computed(() =>
    this.activeTab() === TAB.ALL_IN_ONE
      ? environment.bundlePackageDurations
      : environment.packageDurations,
  );

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
    } else if (tab === TAB.ALL_IN_ONE) {
      // All-in-one packages come from the same call as the ad packages below, so
      // there is nothing extra to fetch for this tab.
      this.activeTab.set(TAB.ALL_IN_ONE);
    }

    this.loadPackages();
    this.loadCategories();
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
    // Terms differ per tab, so a duration carried over from the previous one can
    // match nothing — leaving a tab that looks empty for no visible reason.
    this.selectedDuration.set(null);
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
        this.error.set(ERROR_MSG.PACKAGES_LOAD_FAILED);
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

  /**
   * Single-purpose ad packages — recomputed when packages, type or duration change.
   *
   * All-in-one packages are excluded because they have their own tab. They used to
   * appear here alongside featured-ads and ad-slots packages, where the quantity
   * column read as a single number for a package that actually grants three
   * different things.
   */
  readonly filteredPackages = computed(() => {
    let result = this.packages().filter((p) => p.type !== PackageTypeEnum.BUNDLE);
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

  /** All-in-one packages, for their own tab. */
  readonly filteredBundles = computed(() => {
    const duration = this.selectedDuration();
    return this.packages().filter(
      (p) => p.type === PackageTypeEnum.BUNDLE && (duration === null || p.duration === duration),
    );
  });

  setType(type: PackageType | 'all'): void {
    this.selectedType.set(type);
  }

  setDuration(duration: number | null): void {
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
    // A map, not a ternary: the old form rendered every unrecognised type — a
    // bundle among them — with the ad-slots icon.
    return PACKAGE_TYPE_ICONS[type] ?? 'inventory_2';
  }

  /** What an all-in-one includes, for the card body. */
  entitlementsOf(pkg: AdPackage): { label: string; icon: string; quantity: number }[] {
    return (pkg.entitlements ?? []).map((e) => ({
      label: ENTITLEMENT_LABELS[e.kind] ?? e.kind,
      icon: ENTITLEMENT_ICONS[e.kind] ?? 'check',
      quantity: e.quantity,
    }));
  }

  getDurationLabel(duration: number): string {
    return `${duration} days`;
  }
}
