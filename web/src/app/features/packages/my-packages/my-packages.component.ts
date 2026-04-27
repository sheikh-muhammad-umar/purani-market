import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PackagesService } from '../../../core/services/packages.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { PackagePurchase, PaymentStatus, Category } from '../../../core/models';
import {
  PaymentStatus as PaymentStatusEnum,
  PackageType as PackageTypeEnum,
} from '../../../core/constants/enums';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { CURRENCY_SYMBOL, PAYMENT_METHOD_CONFIG } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './my-packages.component.html',
  styleUrls: ['./my-packages.component.scss'],
})
export class MyPackagesComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly purchases = signal<PackagePurchase[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'active' | 'history'>('active');
  readonly selectedCategoryId = signal<string>('');

  private pendingFilterChange = false;

  constructor(
    private readonly packagesService: PackagesService,
    private readonly categoriesService: CategoriesService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadPurchases();
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
        this.error.set('Failed to load your packages. Please try again.');
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

  /** Active purchases — computed once per signal change, not per CD cycle. */
  readonly activePurchases = computed(() => {
    const now = new Date();
    return this.purchases().filter(
      (p) =>
        p.paymentStatus === PaymentStatusEnum.COMPLETED &&
        p.expiresAt &&
        new Date(p.expiresAt) > now &&
        p.remainingQuantity > 0,
    );
  });

  /** Expired / failed / fully-used purchases. */
  readonly historyPurchases = computed(() => {
    const now = new Date();
    return this.purchases().filter(
      (p) =>
        p.paymentStatus !== PaymentStatusEnum.COMPLETED ||
        !p.expiresAt ||
        new Date(p.expiresAt) <= now ||
        p.remainingQuantity <= 0,
    );
  });

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

  getTypeLabel(type: string): string {
    return type === PackageTypeEnum.FEATURED_ADS ? 'Featured Ads' : 'Ad Slots';
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
}
