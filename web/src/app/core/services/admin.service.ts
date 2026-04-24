import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserRole, UserStatus } from '../models/user.model';
import { ListingImage, ListingStatus } from '../models/listing.model';
import {
  AdPackage,
  PackagePurchase,
  PackageType,
  PaymentMethod,
  PaymentStatus,
} from '../models/package.model';
import {
  MetricsSummary,
  TimeSeriesPoint,
  TimeSeriesData,
  CategoryAnalytics,
  AnalyticsData,
  DateRange,
  AppBannerStats,
  EngagementAnalytics,
  PriceTrendsData,
} from '../models/analytics.model';
import { API } from '../constants/api-endpoints';
import { IdVerificationStats } from '../models/id-verification.model';

export type {
  MetricsSummary,
  TimeSeriesPoint,
  TimeSeriesData,
  CategoryAnalytics,
  AnalyticsData,
  DateRange,
  AppBannerStats,
  EngagementAnalytics,
  PriceTrendsData,
} from '../models/analytics.model';

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
  location?: { city?: string; area?: string; mapLink?: string };
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
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ANALYTICS}`, { params })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  exportReport(dateRange: DateRange): Observable<Blob> {
    const params = new HttpParams()
      .set('dateFrom', dateRange.startDate)
      .set('dateTo', dateRange.endDate);
    return this.http.get(`${this.baseUrl}${API.ADMIN_ANALYTICS_EXPORT}`, {
      params,
      responseType: 'blob',
    });
  }

  getAppBannerStats(dateRange?: DateRange): Observable<AppBannerStats> {
    let params = new HttpParams();
    if (dateRange?.startDate) params = params.set('dateFrom', dateRange.startDate);
    if (dateRange?.endDate) params = params.set('dateTo', dateRange.endDate);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ANALYTICS_APP_BANNER}`, { params })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  getEngagementAnalytics(dateRange?: DateRange): Observable<EngagementAnalytics> {
    let params = new HttpParams();
    if (dateRange?.startDate) params = params.set('dateFrom', dateRange.startDate);
    if (dateRange?.endDate) params = params.set('dateTo', dateRange.endDate);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ANALYTICS_ENGAGEMENT}`, { params })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  getPriceTrends(dateRange?: DateRange): Observable<PriceTrendsData> {
    let params = new HttpParams();
    if (dateRange?.startDate) params = params.set('dateFrom', dateRange.startDate);
    if (dateRange?.endDate) params = params.set('dateTo', dateRange.endDate);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ANALYTICS_PRICE_TRENDS}`, { params })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
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
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_USERS}`, { params: httpParams })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  updateUserStatus(userId: string, status: UserStatus): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}${API.ADMIN_USER_STATUS(userId)}`, { status });
  }

  updateUserRole(userId: string, role: UserRole): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}${API.ADMIN_USER_ROLE(userId)}`, { role });
  }

  updateAdLimit(userId: string, limit: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}${API.ADMIN_USER_AD_LIMIT(userId)}`, {
      adLimit: limit,
    });
  }

  getPermissionsList(): Observable<{
    permissions: { key: string; value: string; group: string; action: string }[];
  }> {
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_PERMISSIONS}`)
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  updatePermissions(userId: string, permissions: string[]): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}${API.ADMIN_USER_PERMISSIONS(userId)}`, {
      permissions,
    });
  }

  // ── Rejection Reasons ──────────────────────────────────────────
  getRejectionReasons(all = false): Observable<any[]> {
    const params = all ? '?all=true' : '';
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_REJECTION_REASONS}${params}`)
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  createRejectionReason(data: { title: string; description?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}${API.ADMIN_REJECTION_REASONS}`, data);
  }

  updateRejectionReason(
    id: string,
    data: { title?: string; description?: string; isActive?: boolean },
  ): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}${API.ADMIN_REJECTION_REASON_BY_ID(id)}`, data);
  }

  deleteRejectionReason(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}${API.ADMIN_REJECTION_REASON_BY_ID(id)}`);
  }

  // ── Deletion Reasons ───────────────────────────────────────────
  getDeletionReasons(all = false): Observable<any[]> {
    const params = all ? '?all=true' : '';
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_DELETION_REASONS}${params}`)
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  createDeletionReason(data: { title: string; description?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}${API.ADMIN_DELETION_REASONS}`, data);
  }

  updateDeletionReason(
    id: string,
    data: { title?: string; description?: string; isActive?: boolean },
  ): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}${API.ADMIN_DELETION_REASON_BY_ID(id)}`, data);
  }

  deleteDeletionReason(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}${API.ADMIN_DELETION_REASON_BY_ID(id)}`);
  }

  getPendingListings(): Observable<PendingListingsResponse> {
    return this.http.get<PendingListingsResponse>(`${this.baseUrl}${API.ADMIN_LISTINGS_PENDING}`);
  }

  getAllListings(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      categoryId?: string;
      provinceId?: string;
      cityId?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      rejectionReason?: string;
      deletionReason?: string;
    } = {},
  ): Observable<any> {
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
    if (params.rejectionReason)
      httpParams = httpParams.set('rejectionReason', params.rejectionReason);
    if (params.deletionReason) httpParams = httpParams.set('deletionReason', params.deletionReason);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_LISTINGS_ALL}`, { params: httpParams })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  approveListing(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}${API.ADMIN_LISTING_APPROVE(id)}`, {});
  }

  rejectListing(
    id: string,
    payload: { rejectionReasonIds: string[]; customNote?: string },
  ): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}${API.ADMIN_LISTING_REJECT(id)}`, payload);
  }

  // --- Package Management ---
  getAdminPackages(): Observable<AdminPackagesResponse> {
    return this.http.get<AdminPackagesResponse>(`${this.baseUrl}${API.PACKAGES}`);
  }

  createPackage(payload: CreatePackagePayload): Observable<AdPackage> {
    return this.http.post<AdPackage>(`${this.baseUrl}${API.PACKAGES}`, payload);
  }

  updatePackage(id: string, payload: UpdatePackagePayload): Observable<AdPackage> {
    return this.http.patch<AdPackage>(`${this.baseUrl}${API.PACKAGE_BY_ID(id)}`, payload);
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
    return this.http.get<AdminPurchasesResponse>(`${this.baseUrl}${API.ADMIN_PACKAGES_PURCHASES}`, {
      params: httpParams,
    });
  }

  getAdminPayments(params: AdminPaymentsParams = {}): Observable<AdminPaymentsResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.startDate) httpParams = httpParams.set('dateFrom', params.startDate);
    if (params.endDate) httpParams = httpParams.set('dateTo', params.endDate);
    if (params.paymentMethod) httpParams = httpParams.set('paymentMethod', params.paymentMethod);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_PAYMENTS}`, { params: httpParams })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  getUserActivity(userId: string, page = 1, limit = 50, action?: string): Observable<any> {
    let httpParams = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (action) httpParams = httpParams.set('action', action);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_USER_ACTIVITY(userId)}`, { params: httpParams })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  getAllActivity(
    params: {
      page?: number;
      limit?: number;
      action?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    } = {},
  ): Observable<any> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.action) httpParams = httpParams.set('action', params.action);
    if (params.userId) httpParams = httpParams.set('userId', params.userId);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ACTIVITY}`, { params: httpParams })
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }

  getIdVerificationStats(): Observable<IdVerificationStats> {
    return this.http
      .get<any>(`${this.baseUrl}${API.ADMIN_ID_VERIFICATION_STATS}`)
      .pipe(map((res) => (res && res.data && res.statusCode ? res.data : res)));
  }
}
