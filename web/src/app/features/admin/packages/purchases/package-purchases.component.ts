import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminPurchasesParams } from '../../../../core/services/admin.service';
import { PackagePurchase, PackageType, PaymentStatus } from '../../../../core/models';
import {
  PACKAGE_TYPE_FILTER_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '../../../../core/constants/select-options';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../../shared/components/custom-select/custom-select.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import {
  PackageType as PackageTypeEnum,
  PaymentStatus as PaymentStatusEnum,
} from '../../../../core/constants/enums';
import { ERROR_MSG } from '../../../../core/constants/error-messages';

/** Display labels for package types used in template */
const PACKAGE_TYPE_LABELS: Record<string, string> = {
  [PackageTypeEnum.FEATURED_ADS]: 'Featured',
  [PackageTypeEnum.AD_SLOTS]: 'Ad Slots',
};

@Component({
  selector: 'app-package-purchases',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomSelectComponent,
    DatePickerComponent,
    EmptyStateComponent,
    PaginationComponent,
    ModalComponent,
  ],
  templateUrl: './package-purchases.component.html',
  styleUrls: ['./package-purchases.component.scss'],
})
export class PackagePurchasesComponent implements OnInit {
  readonly PackageTypeEnum = PackageTypeEnum;
  readonly PACKAGE_TYPE_LABELS = PACKAGE_TYPE_LABELS;
  readonly PaymentStatusEnum = PaymentStatusEnum;

  /** Purchase awaiting refund confirmation; null when the modal is closed. */
  readonly refundTarget = signal<PackagePurchase | null>(null);
  readonly refundLoading = signal(false);
  readonly refundError = signal<string | null>(null);
  refundReason = '';

  readonly purchases = signal<PackagePurchase[]>([]);
  readonly purchasesTotal = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Purchase filters
  purchaseFilterSearch = '';
  purchaseFilterStartDate = '';
  purchaseFilterEndDate = '';
  readonly today = new Date().toISOString().split('T')[0];
  purchaseFilterType: PackageType | '' = '';
  purchaseFilterStatus: PaymentStatus | '' = '';

  purchasePage = 1;
  readonly purchaseLimit = 10;

  readonly totalPurchasePages = computed(
    () => Math.ceil(this.purchasesTotal() / this.purchaseLimit) || 1,
  );

  readonly purchaseTypeOptions: SelectOption[] = PACKAGE_TYPE_FILTER_OPTIONS;
  readonly purchaseStatusOptions: SelectOption[] = PAYMENT_STATUS_OPTIONS;

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadPurchases();
  }

  loadPurchases(): void {
    this.loading.set(true);
    this.error.set(null);
    const params: AdminPurchasesParams = {
      page: this.purchasePage,
      limit: this.purchaseLimit,
    };
    if (this.purchaseFilterStartDate) params.startDate = this.purchaseFilterStartDate;
    if (this.purchaseFilterEndDate) params.endDate = this.purchaseFilterEndDate;
    if (this.purchaseFilterSearch) params.sellerId = this.purchaseFilterSearch;
    if (this.purchaseFilterType) params.type = this.purchaseFilterType;
    if (this.purchaseFilterStatus) params.status = this.purchaseFilterStatus;

    this.adminService.getAdminPurchases(params).subscribe({
      next: (res: any) => {
        const unwrapped = res && res.data && res.statusCode ? res.data : res;
        this.purchases.set(unwrapped.data ?? unwrapped ?? []);
        this.purchasesTotal.set(unwrapped.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(ERROR_MSG.PURCHASES_LOAD_FAILED);
        this.loading.set(false);
      },
    });
  }

  applyPurchaseFilters(): void {
    this.purchasePage = 1;
    this.loadPurchases();
  }

  resetPurchaseFilters(): void {
    this.purchaseFilterSearch = '';
    this.purchaseFilterStartDate = '';
    this.purchaseFilterEndDate = '';
    this.purchaseFilterType = '';
    this.purchaseFilterStatus = '';
    this.purchasePage = 1;
    this.loadPurchases();
  }

  nextPurchasePage(): void {
    this.purchasePage++;
    this.loadPurchases();
  }

  prevPurchasePage(): void {
    if (this.purchasePage > 1) {
      this.purchasePage--;
      this.loadPurchases();
    }
  }

  /** Jump to an absolute page number. Used by the shared pagination control. */
  goToPurchasePage(page: number): void {
    if (page < 1 || page > this.totalPurchasePages() || page === this.purchasePage) return;
    this.purchasePage = page;
    this.loadPurchases();
  }

  /** Only a completed purchase can be withdrawn; the rest never took money. */
  canRefund(purchase: PackagePurchase): boolean {
    return purchase.paymentStatus === PaymentStatusEnum.COMPLETED;
  }

  openRefundModal(purchase: PackagePurchase): void {
    this.refundTarget.set(purchase);
    this.refundReason = '';
    this.refundError.set(null);
  }

  closeRefundModal(): void {
    if (this.refundLoading()) return;
    this.refundTarget.set(null);
  }

  confirmRefund(): void {
    const purchase = this.refundTarget();
    if (!purchase || this.refundLoading()) return;

    this.refundLoading.set(true);
    this.refundError.set(null);

    this.adminService
      .refundPurchase(purchase._id, this.refundReason.trim() || undefined)
      .subscribe({
        next: () => {
          // Patch in place rather than refetching, so the admin keeps their filters
          // and page position.
          this.purchases.update((list) =>
            list.map((p) =>
              p._id === purchase._id
                ? {
                    ...p,
                    paymentStatus: PaymentStatusEnum.REFUNDED as PaymentStatus,
                    remainingQuantity: 0,
                    refundedAt: new Date(),
                    refundReason: this.refundReason.trim() || undefined,
                  }
                : p,
            ),
          );
          this.refundLoading.set(false);
          this.refundTarget.set(null);
        },
        error: () => {
          this.refundError.set(ERROR_MSG.PURCHASE_REFUND_FAILED);
          this.refundLoading.set(false);
        },
      });
  }
}
