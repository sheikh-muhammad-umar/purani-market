import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminPaymentsParams,
  PaymentTransaction,
} from '../../../core/services/admin.service';
import { PaymentMethod, PaymentStatus } from '../../../core/models';

@Component({
  selector: 'app-payment-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      next: (res) => {
        this.payments.set(res.data);
        this.total.set(res.total);
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
}
