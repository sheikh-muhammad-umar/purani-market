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
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../../shared/components/custom-select/custom-select.component';
import { PackageType as PackageTypeEnum } from '../../../../core/constants/enums';
import { ERROR_MSG } from '../../../../core/constants/error-messages';

/** Display labels for package types used in template */
const PACKAGE_TYPE_LABELS: Record<string, string> = {
  [PackageTypeEnum.FEATURED_ADS]: 'Featured',
  [PackageTypeEnum.AD_SLOTS]: 'Ad Slots',
};

@Component({
  selector: 'app-package-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, DatePickerComponent],
  templateUrl: './package-purchases.component.html',
  styleUrls: ['./package-purchases.component.scss'],
})
export class PackagePurchasesComponent implements OnInit {
  readonly PackageTypeEnum = PackageTypeEnum;
  readonly PACKAGE_TYPE_LABELS = PACKAGE_TYPE_LABELS;

  readonly purchases = signal<PackagePurchase[]>([]);
  readonly purchasesTotal = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Purchase filters
  purchaseFilterStartDate = '';
  purchaseFilterEndDate = '';
  readonly today = new Date().toISOString().split('T')[0];
  purchaseFilterSellerId = '';
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
    if (this.purchaseFilterSellerId) params.sellerId = this.purchaseFilterSellerId;
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
    this.purchaseFilterStartDate = '';
    this.purchaseFilterEndDate = '';
    this.purchaseFilterSellerId = '';
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
}
