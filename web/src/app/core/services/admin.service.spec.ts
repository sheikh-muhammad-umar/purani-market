import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  AdminService,
  AnalyticsData,
  DateRange,
  PendingListingsResponse,
  UsersResponse,
  AdminPackagesResponse,
  AdminPurchasesResponse,
  AdminPaymentsResponse,
} from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  const mockAnalytics: AnalyticsData = {
    metrics: {
      totalUsers: 1200,
      activeUsers: 450,
      totalListings: 3400,
      totalConversations: 890,
      totalPurchases: 120,
      totalRevenue: 560000,
    },
    timeSeries: {
      registrations: [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 15 },
      ],
      listings: [{ date: '2024-01-01', value: 20 }],
      conversations: [{ date: '2024-01-01', value: 5 }],
      purchases: [{ date: '2024-01-01', value: 3 }],
    },
    categoryAnalytics: [
      { categoryId: 'c1', categoryName: 'Electronics', listingCount: 500 },
      { categoryId: 'c2', categoryName: 'Vehicles', listingCount: 300 },
    ],
  };

  beforeEach(() => {
    httpMock = {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
    };
    service = new AdminService(httpMock as any);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call GET /admin/analytics without params', () => {
    httpMock.get.mockReturnValue(of(mockAnalytics));
    service.getAnalytics().subscribe((data) => {
      expect(data).toEqual(mockAnalytics);
    });
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/analytics'),
      expect.objectContaining({ params: expect.anything() }),
    );
  });

  it('should call GET /admin/analytics with date range params', () => {
    httpMock.get.mockReturnValue(of(mockAnalytics));
    const dateRange: DateRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
    service.getAnalytics(dateRange).subscribe((data) => {
      expect(data).toEqual(mockAnalytics);
    });
    expect(httpMock.get).toHaveBeenCalled();
  });

  it('should call GET /admin/analytics/export with blob response', () => {
    const blob = new Blob(['test'], { type: 'text/csv' });
    httpMock.get.mockReturnValue(of(blob));
    const dateRange: DateRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
    service.exportReport(dateRange).subscribe((data) => {
      expect(data).toBeInstanceOf(Blob);
    });
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/analytics/export'),
      expect.objectContaining({ responseType: 'blob' }),
    );
  });

  it('should propagate errors from getAnalytics', () => {
    httpMock.get.mockReturnValue(throwError(() => new Error('Server error')));
    service.getAnalytics().subscribe({
      error: (err) => {
        expect(err.message).toBe('Server error');
      },
    });
  });

  it('should propagate errors from exportReport', () => {
    httpMock.get.mockReturnValue(throwError(() => new Error('Export failed')));
    service.exportReport({ startDate: '2024-01-01', endDate: '2024-01-31' }).subscribe({
      error: (err) => {
        expect(err.message).toBe('Export failed');
      },
    });
  });

  // User management methods
  it('should call GET /admin/users with params', () => {
    const mockRes: UsersResponse = { users: [], total: 0, page: 1, limit: 10 };
    httpMock.get.mockReturnValue(of(mockRes));
    service
      .getUsers({ page: 1, limit: 10, search: 'alice', role: 'seller', status: 'active' })
      .subscribe((data) => {
        expect(data).toEqual(mockRes);
      });
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users'),
      expect.objectContaining({ params: expect.anything() }),
    );
  });

  it('should call GET /admin/users without optional params', () => {
    const mockRes: UsersResponse = { users: [], total: 0, page: 1, limit: 10 };
    httpMock.get.mockReturnValue(of(mockRes));
    service.getUsers().subscribe((data) => {
      expect(data).toEqual(mockRes);
    });
    expect(httpMock.get).toHaveBeenCalled();
  });

  it('should call PATCH /admin/users/:id/status', () => {
    httpMock.patch.mockReturnValue(of(undefined));
    service.updateUserStatus('u1', 'suspended').subscribe();
    expect(httpMock.patch).toHaveBeenCalledWith(expect.stringContaining('/admin/users/u1/status'), {
      status: 'suspended',
    });
  });

  it('should call PATCH /admin/users/:id/role', () => {
    httpMock.patch.mockReturnValue(of(undefined));
    service.updateUserRole('u1', 'admin').subscribe();
    expect(httpMock.patch).toHaveBeenCalledWith(expect.stringContaining('/admin/users/u1/role'), {
      role: 'admin',
    });
  });

  it('should call PATCH /admin/users/:id/ad-limit', () => {
    httpMock.patch.mockReturnValue(of(undefined));
    service.updateAdLimit('u1', 20).subscribe();
    expect(httpMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users/u1/ad-limit'),
      { adLimit: 20 },
    );
  });

  // Moderation queue methods
  it('should call GET /admin/listings/pending', () => {
    const mockRes: PendingListingsResponse = { listings: [], total: 0 };
    httpMock.get.mockReturnValue(of(mockRes));
    service.getPendingListings().subscribe((data) => {
      expect(data).toEqual(mockRes);
    });
    expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/admin/listings/pending'));
  });

  it('should call PATCH /admin/listings/:id/approve', () => {
    httpMock.patch.mockReturnValue(of(undefined));
    service.approveListing('l1').subscribe();
    expect(httpMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/listings/l1/approve'),
      {},
    );
  });

  it('should call PATCH /admin/listings/:id/reject with reason', () => {
    httpMock.patch.mockReturnValue(of(undefined));
    service.rejectListing('l1', 'Inappropriate content').subscribe();
    expect(httpMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/listings/l1/reject'),
      { reason: 'Inappropriate content' },
    );
  });

  it('should propagate errors from getPendingListings', () => {
    httpMock.get.mockReturnValue(throwError(() => new Error('Network error')));
    service.getPendingListings().subscribe({
      error: (err) => {
        expect(err.message).toBe('Network error');
      },
    });
  });

  // --- Package Management ---
  it('should call GET /packages for admin packages', () => {
    const mockRes: AdminPackagesResponse = { data: [], total: 0 };
    httpMock.get.mockReturnValue(of(mockRes));
    service.getAdminPackages().subscribe((data) => {
      expect(data).toEqual(mockRes);
    });
    expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/packages'));
  });

  it('should call POST /packages to create a package', () => {
    const mockPkg = { _id: 'p1', name: 'Test', type: 'featured_ads' };
    httpMock.post.mockReturnValue(of(mockPkg));
    const payload = {
      name: 'Test',
      type: 'featured_ads' as const,
      duration: 7 as const,
      quantity: 5,
      defaultPrice: 500,
    };
    service.createPackage(payload).subscribe((data) => {
      expect(data).toEqual(mockPkg);
    });
    expect(httpMock.post).toHaveBeenCalledWith(expect.stringContaining('/packages'), payload);
  });

  it('should call PATCH /packages/:id to update a package', () => {
    const mockPkg = { _id: 'p1', name: 'Updated' };
    httpMock.patch.mockReturnValue(of(mockPkg));
    service.updatePackage('p1', { name: 'Updated' }).subscribe((data) => {
      expect(data).toEqual(mockPkg);
    });
    expect(httpMock.patch).toHaveBeenCalledWith(expect.stringContaining('/packages/p1'), {
      name: 'Updated',
    });
  });

  it('should call GET /admin/packages/purchases with params', () => {
    const mockRes: AdminPurchasesResponse = { data: [], total: 0, page: 1, limit: 10 };
    httpMock.get.mockReturnValue(of(mockRes));
    service
      .getAdminPurchases({ page: 1, limit: 10, type: 'featured_ads', status: 'completed' })
      .subscribe((data) => {
        expect(data).toEqual(mockRes);
      });
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/packages/purchases'),
      expect.objectContaining({ params: expect.anything() }),
    );
  });

  it('should call GET /admin/packages/purchases without optional params', () => {
    const mockRes: AdminPurchasesResponse = { data: [], total: 0, page: 1, limit: 10 };
    httpMock.get.mockReturnValue(of(mockRes));
    service.getAdminPurchases().subscribe((data) => {
      expect(data).toEqual(mockRes);
    });
    expect(httpMock.get).toHaveBeenCalled();
  });

  it('should call GET /admin/payments with params', () => {
    const mockRes: AdminPaymentsResponse = { data: [], total: 0, page: 1, limit: 15 };
    httpMock.get.mockReturnValue(of(mockRes));
    service
      .getAdminPayments({ page: 1, limit: 15, paymentMethod: 'card', status: 'completed' })
      .subscribe((data) => {
        expect(data).toEqual(mockRes);
      });
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/admin/payments'),
      expect.objectContaining({ params: expect.anything() }),
    );
  });

  it('should call GET /admin/payments without optional params', () => {
    const mockRes: AdminPaymentsResponse = { data: [], total: 0, page: 1, limit: 15 };
    httpMock.get.mockReturnValue(of(mockRes));
    service.getAdminPayments().subscribe((data) => {
      expect(data).toEqual(mockRes);
    });
    expect(httpMock.get).toHaveBeenCalled();
  });

  it('should propagate errors from getAdminPackages', () => {
    httpMock.get.mockReturnValue(throwError(() => new Error('Package error')));
    service.getAdminPackages().subscribe({
      error: (err) => {
        expect(err.message).toBe('Package error');
      },
    });
  });

  it('should propagate errors from getAdminPayments', () => {
    httpMock.get.mockReturnValue(throwError(() => new Error('Payment error')));
    service.getAdminPayments().subscribe({
      error: (err) => {
        expect(err.message).toBe('Payment error');
      },
    });
  });
});
