import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PackagesService } from '../../../../core/services/packages.service';
import { ActivityTrackerService } from '../../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../../core/enums/tracking-events';
import { PackagePurchase } from '../../../../core/models';
import { PackageType as PackageTypeEnum } from '../../../../core/constants/enums';
import { ROUTES } from '../../../../core/constants/routes';
import { Subject, takeUntil } from 'rxjs';

/** Milliseconds in one day — used for remaining-days calculation. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Threshold (days) below which the "X d left" warning appears. */
const EXPIRY_WARNING_DAYS = 7;

/** Locale used for date formatting. */
const DATE_LOCALE = 'en-PK';

/** Date format options. */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

@Component({
  selector: 'app-available-packages',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './available-packages.component.html',
  styleUrls: ['./available-packages.component.scss'],
})
export class AvailablePackagesComponent implements OnChanges, OnDestroy {
  @Input() categoryId: string | null = null;
  @Input() listingId = '';
  @Output() packageSelected = new EventEmitter<string>();

  readonly ROUTES = ROUTES;
  readonly EXPIRY_WARNING_DAYS = EXPIRY_WARNING_DAYS;

  readonly packages = signal<PackagePurchase[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPurchaseId = signal<string | null>(null);

  /** Pre-computed display data for each package — avoids template method calls. */
  readonly packageDisplayData = computed(() =>
    this.packages().map((pkg) => ({
      pkg,
      name: this.extractPackageName(pkg),
      type: this.extractPackageType(pkg),
      typeLabel: this.getTypeLabel(this.extractPackageType(pkg)),
      isFeatured: this.extractPackageType(pkg) === PackageTypeEnum.FEATURED_ADS,
      formattedDate: this.formatDate(pkg.expiresAt),
      remainingDays: this.calcRemainingDays(pkg.expiresAt),
    })),
  );

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly packagesService: PackagesService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categoryId']) {
      this.selectedPurchaseId.set(null);
      this.loadPackages();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectPackage(pkg: PackagePurchase): void {
    this.selectedPurchaseId.set(pkg._id);
    this.packageSelected.emit(pkg._id);

    this.tracker.track(TrackingEvent.PACKAGE_APPLY, {
      categoryId: this.categoryId!,
      metadata: {
        purchaseId: pkg._id,
        packageType: pkg.type,
        categoryId: this.categoryId,
        listingId: this.listingId,
      },
    });
  }

  deselectPackage(): void {
    this.selectedPurchaseId.set(null);
    this.packageSelected.emit('');
  }

  onPurchaseLinkClick(): void {
    this.tracker.track(TrackingEvent.PACKAGE_PURCHASE_CTA_CLICKED, {
      categoryId: this.categoryId!,
      metadata: {
        categoryId: this.categoryId,
        source: 'listing_creation',
      },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────

  private loadPackages(): void {
    if (!this.categoryId) {
      this.packages.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.packagesService
      .getAvailablePackages(this.categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const pkgs = Array.isArray(result) ? result : [];
          this.packages.set(pkgs);
          this.loading.set(false);

          this.tracker.track(TrackingEvent.PACKAGE_LIST_VIEWED, {
            categoryId: this.categoryId!,
            metadata: {
              categoryId: this.categoryId,
              availablePackageCount: pkgs.length,
            },
          });

          if (pkgs.length === 0) {
            this.tracker.track(TrackingEvent.PACKAGE_NONE_AVAILABLE, {
              categoryId: this.categoryId!,
              metadata: { categoryId: this.categoryId },
            });
          }
        },
        error: () => {
          this.error.set('Failed to load available packages.');
          this.loading.set(false);
        },
      });
  }

  private getTypeLabel(type: string): string {
    return type === PackageTypeEnum.FEATURED_ADS ? 'Featured Ads' : 'Ad Slots';
  }

  private extractPackageName(pkg: PackagePurchase): string {
    return (pkg as any).packageId?.name ?? 'Package';
  }

  private extractPackageType(pkg: PackagePurchase): string {
    return (pkg as any).packageId?.type ?? pkg.type;
  }

  private formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(DATE_LOCALE, DATE_FORMAT_OPTIONS);
  }

  private calcRemainingDays(expiresAt: Date | string | undefined): number {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / MS_PER_DAY));
  }
}
