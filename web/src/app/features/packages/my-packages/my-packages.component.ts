import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';
import { PackagesService } from '../../../core/services/packages.service';
import { ShortsService, ShortsPackagePurchase } from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { PackagePurchase, PaymentStatus, Category } from '../../../core/models';
import {
  PaymentStatus as PaymentStatusEnum,
  PackageType as PackageTypeEnum,
  TAB,
  TabType,
} from '../../../core/constants/enums';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  CURRENCY_SYMBOL,
  ENTITLEMENT_ICONS,
  ENTITLEMENT_LABELS,
  PACKAGE_TYPE_LABELS,
  PAYMENT_METHOD_CONFIG,
} from '../../../core/constants/app';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { ROUTES } from '../../../core/constants/routes';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

/** Milliseconds in one day. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Locale used for date formatting. */
const DATE_LOCALE = 'en-PK';

/** Date format options. */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

@Component({
  selector: 'app-my-packages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CustomSelectComponent,
    AppLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './my-packages.component.html',
  styleUrls: ['./my-packages.component.scss'],
})
export class MyPackagesComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly TAB = TAB;
  readonly mainTab = signal<TabType>(TAB.ADS);
  readonly purchases = signal<PackagePurchase[]>([]);
  readonly shortsPurchases = signal<ShortsPackagePurchase[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly loadingShorts = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'active' | 'history'>('active');
  readonly selectedCategoryId = signal<string>('');

  readonly categoryFilterOptions = computed(() => [
    { value: '', label: 'All Categories' },
    ...this.categories().map((c) => ({ value: c._id, label: c.name })),
  ]);

  private pendingFilterChange = false;

  constructor(
    private readonly packagesService: PackagesService,
    private readonly shortsService: ShortsService,
    private readonly categoriesService: CategoriesService,
    private readonly tracker: ActivityTrackerService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParams['tab'];
    if (tab === TAB.SHORTS) {
      this.mainTab.set(TAB.SHORTS);
      this.loadShortsPurchases();
    } else if (tab === TAB.ALL_IN_ONE) {
      // All-in-one purchases arrive in the same call as the ad purchases below,
      // so this tab has nothing extra to fetch.
      this.mainTab.set(TAB.ALL_IN_ONE);
    }

    this.loadCategories();
    this.loadPurchases();
  }

  switchMainTab(tab: TabType): void {
    this.mainTab.set(tab);
    if (tab === TAB.SHORTS && this.shortsPurchases().length === 0) {
      this.loadShortsPurchases();
    }
  }

  loadShortsPurchases(): void {
    this.loadingShorts.set(true);
    this.shortsService.getMyPurchases().subscribe({
      next: (purchases) => {
        this.shortsPurchases.set(purchases);
        this.loadingShorts.set(false);
      },
      error: () => this.loadingShorts.set(false),
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
    this.error.set(null);
    const categoryId = this.selectedCategoryId() || undefined;
    this.packagesService.getMyPurchases(categoryId).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res.data ?? []);
        this.purchases.set(data);
        this.loading.set(false);
        this.tracker.track(TrackingEvent.MY_PACKAGES_VIEWED, {
          metadata: { categoryId: categoryId ?? 'all' },
        });
        if (this.pendingFilterChange) {
          this.pendingFilterChange = false;
          this.tracker.track(TrackingEvent.MY_PACKAGES_FILTER_CHANGED, {
            metadata: { categoryId: categoryId ?? 'all', resultCount: data.length },
          });
        }
      },
      error: () => {
        this.error.set(ERROR_MSG.MY_PACKAGES_LOAD_FAILED);
        this.loading.set(false);
        this.pendingFilterChange = false;
      },
    });
  }

  onCategoryFilterChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.pendingFilterChange = true;
    this.loadPurchases();
  }

  setTab(tab: 'active' | 'history'): void {
    this.activeTab.set(tab);
  }

  /** Single-purpose ad purchases. All-in-one purchases have their own tab. */
  readonly adsPurchases = computed(() =>
    this.purchases().filter((p) => p.type !== PackageTypeEnum.BUNDLE),
  );

  /** All-in-one purchases, which carry a balance per kind rather than one total. */
  readonly bundlePurchases = computed(() =>
    this.purchases().filter((p) => p.type === PackageTypeEnum.BUNDLE),
  );

  /**
   * How many units a purchase can still be spent on, whichever shape it uses.
   *
   * An all-in-one tracks a balance per entitlement and never decrements
   * `remainingQuantity`, so reading that field alone reported a fully-spent bundle
   * as untouched — it stayed under Active for ever and its meter never moved.
   *
   * A legacy purchase stores -1 in `remainingQuantity` to mean "expiry already
   * processed", which is a marker rather than a balance, so it is clamped.
   */
  private remainingUnits(purchase: PackagePurchase): number {
    if (purchase.entitlements?.length) {
      return purchase.entitlements.reduce((sum, e) => sum + Math.max(0, e.remaining), 0);
    }
    return Math.max(0, purchase.remainingQuantity);
  }

  /** Whether a purchase is paid for, unexpired, and still has something left. */
  private isActivePurchase(purchase: PackagePurchase): boolean {
    return (
      purchase.paymentStatus === PaymentStatusEnum.COMPLETED &&
      !!purchase.expiresAt &&
      new Date(purchase.expiresAt).getTime() > Date.now() &&
      this.remainingUnits(purchase) > 0
    );
  }

  /** Active purchases — computed once per signal change, not per CD cycle. */
  readonly activePurchases = computed(() =>
    this.adsPurchases().filter((p) => this.isActivePurchase(p)),
  );

  /** Expired / failed / fully-used purchases. */
  readonly historyPurchases = computed(() =>
    this.adsPurchases().filter((p) => !this.isActivePurchase(p)),
  );

  readonly activeBundles = computed(() =>
    this.bundlePurchases().filter((p) => this.isActivePurchase(p)),
  );

  readonly historyBundles = computed(() =>
    this.bundlePurchases().filter((p) => !this.isActivePurchase(p)),
  );

  /**
   * What an all-in-one purchase still holds, per kind.
   *
   * Shown as one meter each because the parts are spent separately: a seller can be
   * out of shorts while still holding featured ads, which a single combined figure
   * would hide.
   */
  entitlementBalances(
    purchase: PackagePurchase,
  ): { label: string; icon: string; remaining: number; quantity: number }[] {
    return (purchase.entitlements ?? []).map((e) => ({
      label: ENTITLEMENT_LABELS[e.kind] ?? e.kind,
      icon: ENTITLEMENT_ICONS[e.kind] ?? 'check',
      remaining: Math.max(0, e.remaining),
      quantity: e.quantity,
    }));
  }

  /** Percentage for a meter bar, guarding the divide-by-zero a bad row could cause. */
  meterPercent(remaining: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.max(0, (remaining / total) * 100));
  }

  getStatusBadgeClass(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatusEnum.COMPLETED:
        return 'badge-success';
      case PaymentStatusEnum.PENDING:
        return 'badge-pending';
      case PaymentStatusEnum.FAILED:
        return 'badge-error';
      case PaymentStatusEnum.REFUNDED:
        return 'badge-warning';
      default:
        return '';
    }
  }

  /**
   * Reads the label off the shared map rather than a ternary.
   *
   * The ternary this replaced returned "Ad Slots" for anything that was not
   * featured ads, so every all-in-one purchase was labelled as ad slots.
   */
  getTypeLabel(type: string): string {
    return PACKAGE_TYPE_LABELS[type] ?? type;
  }

  formatPrice(price: number): string {
    return `${CURRENCY_SYMBOL} ${price.toLocaleString()}`;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(DATE_LOCALE, DATE_FORMAT_OPTIONS);
  }

  getRemainingDays(expiresAt: Date | string | undefined): number {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / MS_PER_DAY));
  }

  getPaymentMethodLabel(method: string): string {
    return PAYMENT_METHOD_CONFIG[method]?.label ?? method;
  }

  isShortsPurchaseActive(purchase: ShortsPackagePurchase): boolean {
    return (
      purchase.paymentStatus === 'completed' &&
      !!purchase.expiresAt &&
      new Date(purchase.expiresAt) > new Date() &&
      purchase.remainingQuantity > 0
    );
  }
}
