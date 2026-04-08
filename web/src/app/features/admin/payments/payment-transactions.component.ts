import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminPaymentsParams,
  PaymentTransaction,
} from '../../../core/services/admin.service';
import { PaymentMethod, PaymentStatus } from '../../../core/models';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-payment-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './payment-transactions.component.html',
  styleUrls: ['./payment-transactions.component.scss'],
})
export class PaymentTransactionsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly payments = signal<PaymentTransaction[]>([]);
  readonly total = signal(0);

  filterStartDate = '';
  filterEndDate = '';
  filterPaymentMethod: PaymentMethod | '' = '';
  filterStatus: PaymentStatus | '' = '';

  // Sorting
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly paymentMethodOptions: SelectOption[] = [
    { value: '', label: 'All' },
    { value: 'jazzcash', label: 'JazzCash' },
    { value: 'easypaisa', label: 'EasyPaisa' },
    { value: 'card', label: 'Card' },
  ];

  readonly paymentStatusOptions: SelectOption[] = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ];
  page = 1;
  readonly limit = 15;

  constructor(readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.loading.set(true);
    this.error.set(null);
    const params: AdminPaymentsParams = {
      page: this.page,
      limit: this.limit,
    };
    if (this.filterStartDate) params.startDate = this.filterStartDate;
    if (this.filterEndDate) params.endDate = this.filterEndDate;
    if (this.filterPaymentMethod) params.paymentMethod = this.filterPaymentMethod;
    if (this.filterStatus) params.status = this.filterStatus;

    this.adminService.getAdminPayments(params).subscribe({
      next: (res: any) => {
        this.payments.set(res.data ?? res ?? []);
        this.total.set(res.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load payment transactions.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadPayments();
  }

  resetFilters(): void {
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterPaymentMethod = '';
    this.filterStatus = '';
    this.page = 1;
    this.loadPayments();
  }

  nextPage(): void {
    this.page++;
    this.loadPayments();
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadPayments();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit) || 1;
  }

  sortPayments(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.payments.update(list => [...list].sort((a: any, b: any) => {
      const va = a[col]; const vb = b[col];
      if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
      return ((va ?? 0) - (vb ?? 0)) * dir;
    }));
  }

  sortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }
}
