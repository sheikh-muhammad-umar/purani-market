import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';

export interface ShortVideo {
  _id: string;
  sellerId: {
    _id: string;
    profile: { firstName: string; lastName: string; avatar?: string };
    phone?: string;
  };
  title?: string;
  description?: string;
  categoryId?: { _id: string; name: string; slug?: string } | string;
  categoryName?: string;
  price?: number;
  currency?: string;
  location?: {
    provinceId?: string;
    cityId?: string;
    areaId?: string;
    province?: string;
    city?: string;
    area?: string;
  };
  video: {
    url: string;
    thumbnailUrl?: string;
    compressedUrl?: string;
    duration?: number;
    originalSize?: number;
    compressedSize?: number;
    width?: number;
    height?: number;
  };
  status: string;
  rejectionReason?: string;
  viewCount: number;
  favoriteCount: number;
  expiresAt?: string;
  isPaid: boolean;
  linkedListingId?: any;
  isLikedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShortsResponse {
  data: ShortVideo[];
  total: number;
  page: number;
  limit: number;
  seed?: string;
}

export interface ShortsStats {
  totalShorts: number;
  activeShorts: number;
  pendingShorts: number;
  freeRemaining: number;
  freeUsedThisMonth: number;
  freeRemainingThisMonth: number;
  totalViews: number;
}

export interface ShortsPackage {
  _id: string;
  name: string;
  quantity: number;
  duration: number;
  price: number;
  isActive: boolean;
  description?: string;
}

export interface ShortsPackagePurchase {
  _id: string;
  purchaseType: 'shorts';
  packageId: { _id: string; name: string };
  sellerId?: {
    _id: string;
    profile?: { firstName?: string; lastName?: string };
    email?: string;
    phone?: string;
  };
  quantity: number;
  remainingQuantity: number;
  duration: number;
  price: number;
  paymentStatus: string;
  expiresAt?: string;
  createdAt: string;
}

/**
 * Credit that can be spent on a short right now.
 *
 * Distinct from `ShortsPackagePurchase`, which is a history row that includes
 * spent and expired purchases. The balance here is per kind, so the shorts
 * allowance inside an all-in-one bundle reports correctly instead of as the
 * bundle's combined total across every kind.
 */
export interface UsableShortsPackage {
  purchaseId: string;
  packageName: string;
  remaining: number;
  expiresAt: string | null;
  durationDays: number;
}

@Injectable({ providedIn: 'root' })
export class ShortsService {
  constructor(private readonly api: ApiService) {}

  // Public
  getFeed(
    page: number = 1,
    limit: number = 10,
    filters?: Record<string, any>,
  ): Observable<ShortsResponse> {
    const params: Record<string, any> = { page, limit };
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
    }
    return this.api.get<ShortsResponse>(API.SHORTS_FEED, params);
  }

  getSellerShorts(
    sellerId: string,
    page: number = 1,
    limit: number = 10,
  ): Observable<ShortsResponse> {
    return this.api.get<ShortsResponse>(API.SHORTS_BY_SELLER(sellerId), { page, limit });
  }

  getShortById(id: string): Observable<ShortVideo> {
    return this.api.get<ShortVideo>(API.SHORT_BY_ID(id));
  }

  // Authenticated
  getMyShorts(page: number = 1, limit: number = 10): Observable<ShortsResponse> {
    return this.api.get<ShortsResponse>(API.SHORTS_MY_LIST, { page, limit });
  }

  getMyLikedShorts(page: number = 1, limit: number = 20): Observable<ShortsResponse> {
    return this.api.get<ShortsResponse>(API.SHORTS_MY_LIKED, { page, limit });
  }

  getMyStats(): Observable<ShortsStats> {
    return this.api.get<ShortsStats>(API.SHORTS_MY_STATS);
  }

  uploadShort(formData: FormData): Observable<ShortVideo> {
    return this.api.post<ShortVideo>(API.SHORTS_CREATE, formData);
  }

  deleteShort(id: string): Observable<any> {
    return this.api.delete(API.SHORT_DELETE(id));
  }

  updateShort(id: string, data: Record<string, any>): Observable<ShortVideo> {
    return this.api.patch<ShortVideo>(API.SHORT_UPDATE(id), data);
  }

  likeShort(id: string): Observable<{ liked: boolean; favoriteCount: number }> {
    return this.api.post<{ liked: boolean; favoriteCount: number }>(API.SHORT_LIKE(id), {});
  }

  unlikeShort(id: string): Observable<{ liked: boolean; favoriteCount: number }> {
    return this.api.delete<{ liked: boolean; favoriteCount: number }>(API.SHORT_LIKE(id));
  }

  shareShort(id: string): Observable<{ shareCount: number }> {
    return this.api.post<{ shareCount: number }>(API.SHORT_SHARE(id), {});
  }

  // Packages
  getAvailablePackages(): Observable<ShortsPackage[]> {
    return this.api.get<ShortsPackage[]>(API.SHORTS_PACKAGES_AVAILABLE);
  }

  purchasePackage(packageId: string, paymentMethod: string): Observable<ShortsPackagePurchase> {
    return this.api.post<ShortsPackagePurchase>(API.SHORTS_PACKAGES_PURCHASE, {
      packageId,
      paymentMethod,
    });
  }

  getMyPurchases(): Observable<ShortsPackagePurchase[]> {
    return this.api.get<ShortsPackagePurchase[]>(API.SHORTS_PACKAGES_MY_PURCHASES);
  }

  /**
   * Packages the seller can spend on the short they are about to upload,
   * soonest-expiring first. Bundles are included, since their shorts allowance is
   * spendable too.
   */
  getUsableShortsPackages(): Observable<UsableShortsPackage[]> {
    return this.api.get<UsableShortsPackage[]>(API.SHORTS_PACKAGES_USABLE);
  }

  // Admin
  adminListShorts(params: Record<string, any> = {}): Observable<ShortsResponse> {
    return this.api.get<ShortsResponse>(API.SHORTS_ADMIN_LIST, params);
  }

  adminApproveShort(id: string): Observable<ShortVideo> {
    return this.api.patch<ShortVideo>(API.SHORTS_ADMIN_APPROVE(id), {});
  }

  adminRejectShort(id: string, rejectionReason: string): Observable<ShortVideo> {
    return this.api.patch<ShortVideo>(API.SHORTS_ADMIN_REJECT(id), {
      status: 'rejected',
      rejectionReason,
    });
  }

  adminDeleteShort(id: string): Observable<any> {
    return this.api.delete(API.SHORTS_ADMIN_DELETE(id));
  }

  adminGetPackages(): Observable<ShortsPackage[]> {
    return this.api.get<ShortsPackage[]>(API.SHORTS_ADMIN_PACKAGES);
  }

  adminCreatePackage(data: Partial<ShortsPackage>): Observable<ShortsPackage> {
    return this.api.post<ShortsPackage>(API.SHORTS_ADMIN_PACKAGES_CREATE, data);
  }

  adminUpdatePackage(id: string, data: Partial<ShortsPackage>): Observable<ShortsPackage> {
    return this.api.patch<ShortsPackage>(API.SHORTS_ADMIN_PACKAGES_UPDATE(id), data);
  }

  adminListPurchases(status: string = 'pending'): Observable<ShortsPackagePurchase[]> {
    return this.api.get<ShortsPackagePurchase[]>(API.SHORTS_ADMIN_PURCHASES, { status });
  }

  adminConfirmPayment(purchaseId: string): Observable<any> {
    return this.api.patch(API.SHORTS_ADMIN_PURCHASES_CONFIRM(purchaseId), {});
  }

  adminGetAnalytics(params?: Record<string, any>): Observable<any> {
    return this.api.get<any>(API.SHORTS_ADMIN_ANALYTICS, params);
  }
}
