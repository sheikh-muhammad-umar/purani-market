import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserRole, UserStatus } from '../models/user.model';
import { ListingImage, ListingStatus } from '../models/listing.model';
import { AdPackage, PackagePurchase, PackageType, PaymentMethod, PaymentStatus } from '../models/package.model';

export interface AdminUser {
  _id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  permissions?: string[];
  status: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  idVerified?: boolean;
  profile: {
    firstName: string;
    lastName: string;
    avatar: string;
  };
  adLimit: number;
  activeAdCount: number;
  createdAt: string;
  lastLoginAt?: string;
  listingsCount: number;
  conversationsCount: number;
  violationsCount: number;
  activitySummary?: {
    listingsCount: number;
    activeListingsCount: number;
    conversationsCount: number;
    violationsCount: number;
  };
  activePackages?: {
    count: number;
    packages: { name: string; type: string; expiresAt: string }[];
  };
}

export interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
  startDate?: string;
  endDate?: string;
}

export interface MetricsSummary {
  totalUsers: number;
  activeUsers: number;
  totalListings: number;
  totalConversations: number;
  totalPurchases: number;
  totalRevenue: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TimeSeriesData {
  registrations: TimeSeriesPoint[];
  listings: TimeSeriesPoint[];
  conversations: TimeSeriesPoint[];
  purchases: TimeSeriesPoint[];
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  listingCount: number;
}

export interface AnalyticsData {
  metrics: MetricsSummary;
  timeSeries: TimeSeriesData;
  categoryAnalytics: CategoryAnalytics[];
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PendingListing {
  _id: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  categoryId: string;
  categoryName: string;
  condition: string;
  images: ListingImage[];
  status: ListingStatus;
  sellerId: string;
  sellerName: string;
  sellerEmail?: string;
  createdAt: string;
  categoryAttributes?: Record<string, any>;
  selectedFeatures?: string[];
  location?: { city?: string; area?: string };
  contactInfo?: { phone?: string; email?: string };
  rejectionCount?: number;
}

export interface PendingListingsResponse {
  listings: PendingListing[];
  total: number;
}

export interface AdminPackagesResponse {
  data: AdPackage[];
  total: number;
}

export interface CreatePackagePayload {
  name: string;
  type: PackageType;
  duration: 7 | 15 | 30;
  quantity: number;
  defaultPrice: number;
  categoryPricing?: { categoryId: string; price: number }[];
  isActive?: boolean;
}

export interface UpdatePackagePayload {
  name?: string;
  type?: PackageType;
  duration?: 7 | 15 | 30;
  quantity?: number;
  defaultPrice?: number;
  categoryPricing?: { categoryId: string; price: number }[];
  isActive?: boolean;
}

export interface AdminPurchasesParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  type?: PackageType | '';
  status?: PaymentStatus | '';
}

export interface AdminPurchasesResponse {
  data: PackagePurchase[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentTransaction {
  _id: string;
  sellerId: string;
  sellerName: string;
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId: string;
  createdAt: string;
}

export interface AdminPaymentsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod | '';
  status?: PaymentStatus | '';
}

export interface AdminPaymentsResponse {
  data: PaymentTransaction[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getAnalytics(dateRange?: DateRange): Observable<AnalyticsData> {
    let params = new HttpParams();
    if (dateRange) {
      params = params.set('dateFrom', dateRange.startDate);
      params = params.set('dateTo', dateRange.endDate);
    }
    return this.http.get<any>(`${this.baseUrl}/admin/analytics`, { params }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  exportReport(dateRange: DateRange): Observable<Blob> {
    const params = new HttpParams()
      .set('startDate', dateRange.startDate)
      .set('endDate', dateRange.endDate);
    return this.http.get(`${this.baseUrl}/admin/analytics/export`, {
      params,
      responseType: 'blob',
    });
  }

  getUsers(params: GetUsersParams = {}): Observable<UsersResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.role) httpParams = httpParams.set('role', params.role);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.startDate) httpParams = httpParams.set('registeredFrom', params.startDate);
    if (params.endDate) httpParams = httpParams.set('registeredTo', params.endDate);
    return this.http.get<any>(`${this.baseUrl}/admin/users`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  updateUserStatus(userId: string, status: UserStatus): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/users/${userId}/status`, { status });
  }

  updateUserRole(userId: string, role: UserRole): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/users/${userId}/role`, { role });
  }

  updateAdLimit(userId: string, limit: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/users/${userId}/ad-limit`, { adLimit: limit });
  }

  getPermissionsList(): Observable<{ permissions: { key: string; value: string; group: string; action: string }[] }> {
    return this.http.get<any>(`${this.baseUrl}/admin/permissions`).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  updatePermissions(userId: string, permissions: string[]): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/admin/users/${userId}/permissions`, { permissions });
  }

  // ── Rejection Reasons ──────────────────────────────────────────
  getRejectionReasons(all = false): Observable<any[]> {
    const params = all ? '?all=true' : '';
    return this.http.get<any>(`${this.baseUrl}/admin/rejection-reasons${params}`).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  createRejectionReason(data: { title: string; description?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/rejection-reasons`, data);
  }

  updateRejectionReason(id: string, data: { title?: string; description?: string; isActive?: boolean }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/admin/rejection-reasons/${id}`, data);
  }

  deleteRejectionReason(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/admin/rejection-reasons/${id}`);
  }

  // ── Deletion Reasons ───────────────────────────────────────────
  getDeletionReasons(all = false): Observable<any[]> {
    const params = all ? '?all=true' : '';
    return this.http.get<any>(`${this.baseUrl}/admin/deletion-reasons${params}`).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  createDeletionReason(data: { title: string; description?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/deletion-reasons`, data);
  }

  updateDeletionReason(id: string, data: { title?: string; description?: string; isActive?: boolean }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/admin/deletion-reasons/${id}`, data);
  }

  deleteDeletionReason(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/admin/deletion-reasons/${id}`);
  }

  getPendingListings(): Observable<PendingListingsResponse> {
    return this.http.get<PendingListingsResponse>(`${this.baseUrl}/admin/listings/pending`);
  }

  getAllListings(params: {
    page?: number; limit?: number; search?: string; status?: string;
    categoryId?: string; provinceId?: string; cityId?: string;
    dateFrom?: string; dateTo?: string; sort?: string; order?: 'asc' | 'desc';
    rejectionReason?: string; deletionReason?: string;
  } = {}): Observable<any> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.provinceId) httpParams = httpParams.set('provinceId', params.provinceId);
    if (params.cityId) httpParams = httpParams.set('cityId', params.cityId);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);
    if (params.rejectionReason) httpParams = httpParams.set('rejectionReason', params.rejectionReason);
    if (params.deletionReason) httpParams = httpParams.set('deletionReason', params.deletionReason);
    return this.http.get<any>(`${this.baseUrl}/admin/listings/all`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  getDeletedListings(params: {
    page?: number; limit?: number; search?: string; reason?: string;
    dateFrom?: string; dateTo?: string; sort?: string; order?: 'asc' | 'desc';
  } = {}): Observable<any> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.reason) httpParams = httpParams.set('reason', params.reason);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);
    return this.http.get<any>(`${this.baseUrl}/admin/listings/deleted`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  approveListing(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/listings/${id}/approve`, {});
  }

  rejectListing(id: string, payload: { rejectionReasonIds: string[]; customNote?: string }): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/admin/listings/${id}/reject`, payload);
  }

  // --- Package Management ---
  getAdminPackages(): Observable<AdminPackagesResponse> {
    return this.http.get<AdminPackagesResponse>(`${this.baseUrl}/packages`);
  }

  createPackage(payload: CreatePackagePayload): Observable<AdPackage> {
    return this.http.post<AdPackage>(`${this.baseUrl}/packages`, payload);
  }

  updatePackage(id: string, payload: UpdatePackagePayload): Observable<AdPackage> {
    return this.http.patch<AdPackage>(`${this.baseUrl}/packages/${id}`, payload);
  }

  // --- Purchase & Payment Management ---
  getAdminPurchases(params: AdminPurchasesParams = {}): Observable<AdminPurchasesResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
    if (params.sellerId) httpParams = httpParams.set('sellerId', params.sellerId);
    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<AdminPurchasesResponse>(`${this.baseUrl}/admin/packages/purchases`, { params: httpParams });
  }

  getAdminPayments(params: AdminPaymentsParams = {}): Observable<AdminPaymentsResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.startDate) httpParams = httpParams.set('dateFrom', params.startDate);
    if (params.endDate) httpParams = httpParams.set('dateTo', params.endDate);
    if (params.paymentMethod) httpParams = httpParams.set('paymentMethod', params.paymentMethod);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<any>(`${this.baseUrl}/admin/payments`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  getUserActivity(userId: string, page = 1, limit = 50, action?: string): Observable<any> {
    let httpParams = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (action) httpParams = httpParams.set('action', action);
    return this.http.get<any>(`${this.baseUrl}/admin/users/${userId}/activity`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }

  getAllActivity(params: {
    page?: number; limit?: number; action?: string; userId?: string;
    dateFrom?: string; dateTo?: string; sort?: string; order?: 'asc' | 'desc';
  } = {}): Observable<any> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.action) httpParams = httpParams.set('action', params.action);
    if (params.userId) httpParams = httpParams.set('userId', params.userId);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);
    return this.http.get<any>(`${this.baseUrl}/admin/activity`, { params: httpParams }).pipe(
      map(res => (res && res.data && res.statusCode) ? res.data : res),
    );
  }
}
