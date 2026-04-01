import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PaymentTransactionsComponent } from './payment-transactions.component';
import { AdminService, PaymentTransaction } from '../../../core/services/admin.service';

const mockPayments: PaymentTransaction[] = [
  {
    _id: 'tx1',
    sellerId: 's1',
    sellerName: 'Ali Khan',
    packageId: 'p1',
    packageName: 'Featured 5',
    amount: 500,
    currency: 'PKR',
    paymentMethod: 'jazzcash',
    paymentStatus: 'completed',
    transactionId: 'TXN-001',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    _id: 'tx2',
    sellerId: 's2',
    sellerName: 'Sara Ahmed',
    packageId: 'p2',
    packageName: 'Ad Slots 10',
    amount: 3800,
    currency: 'PKR',
    paymentMethod: 'card',
    paymentStatus: 'failed',
    transactionId: 'TXN-002',
    createdAt: '2024-01-16T14:30:00Z',
  },
];

function createMockAdminService() {
  return {
    getAdminPayments: vi.fn().mockReturnValue(of({ data: mockPayments, total: 2, page: 1, limit: 15 })),
  };
}

describe('PaymentTransactionsComponent', () => {
  let component: PaymentTransactionsComponent;
  let adminService: ReturnType<typeof createMockAdminService>;

  beforeEach(() => {
    adminService = createMockAdminService();
    component = new PaymentTransactionsComponent(adminService as unknown as AdminService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load payments on init', () => {
    component.ngOnInit();
    expect(adminService.getAdminPayments).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.payments().length).toBe(2);
    expect(component.total()).toBe(2);
  });

  it('should handle load error', () => {
    adminService.getAdminPayments.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load payment transactions.');
  });

  // --- Filters ---
  it('should apply filters and reset page', () => {
    component.ngOnInit();
    component.filterPaymentMethod = 'card';
    component.filterStatus = 'completed';
    component.page = 3;
    component.applyFilters();
    expect(component.page).toBe(1);
    expect(adminService.getAdminPayments).toHaveBeenCalledTimes(2);
  });

  it('should reset filters', () => {
    component.ngOnInit();
    component.filterPaymentMethod = 'jazzcash';
    component.filterStatus = 'failed';
    component.filterStartDate = '2024-01-01';
    component.filterEndDate = '2024-01-31';
    component.resetFilters();
    expect(component.filterPaymentMethod).toBe('');
    expect(component.filterStatus).toBe('');
    expect(component.filterStartDate).toBe('');
    expect(component.filterEndDate).toBe('');
    expect(component.page).toBe(1);
  });

  it('should pass filter params to service', () => {
    component.filterStartDate = '2024-01-01';
    component.filterEndDate = '2024-01-31';
    component.filterPaymentMethod = 'card';
    component.filterStatus = 'completed';
    component.loadPayments();
    expect(adminService.getAdminPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        paymentMethod: 'card',
        status: 'completed',
      }),
    );
  });

  // --- Pagination ---
  it('should go to next page', () => {
    component.ngOnInit();
    component.nextPage();
    expect(component.page).toBe(2);
  });

  it('should go to previous page', () => {
    component.ngOnInit();
    component.page = 3;
    component.prevPage();
    expect(component.page).toBe(2);
  });

  it('should not go below page 1', () => {
    component.ngOnInit();
    component.page = 1;
    component.prevPage();
    expect(component.page).toBe(1);
  });

  it('should calculate total pages', () => {
    component.total.set(45);
    expect(component.totalPages).toBe(3);
  });

  it('should return 1 for zero total', () => {
    component.total.set(0);
    expect(component.totalPages).toBe(1);
  });
});
