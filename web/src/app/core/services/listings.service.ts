import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';
import { STORAGE_SELECTED_LOCATION } from '../constants/storage-keys';
import { DEFAULT_COUNTRY } from '../constants/app';
import { API } from '../constants/api-endpoints';

export interface ListingsResponse {
  data: Listing[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateListingPayload {
  title: string;
  description: string;
  price: { amount: number; currency: string };
  categoryId: string;
  categoryPath: string[];
  condition: string;
  brandId?: string;
  brandName?: string;
  vehicleBrandId?: string;
  vehicleBrandName?: string;
  modelId?: string;
  modelName?: string;
  variantId?: string;
  variantName?: string;
  categoryAttributes: Record<string, unknown>;
  selectedFeatures?: string[];
  location: {
    provinceId?: string;
    cityId?: string;
    areaId?: string;
    city?: string;
    province?: string;
    area?: string;
    blockPhase?: string;
    coordinates?: [number, number];
    mapLink?: string;
  };
  contactInfo?: { phone: string; email: string };
  isFeatured?: boolean;
  purchaseId?: string;
}

export interface MediaUploadResponse {
  url: string;
  thumbnailUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ListingsService {
  constructor(private readonly api: ApiService) {}

  getFeatured(limit: number = 10): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>(API.LISTINGS_FEATURED, { limit });
  }

  getFeaturedFiltered(
    params: { category?: string; city?: string; limit?: number } = {},
  ): Observable<ListingsResponse> {
    const clean: Record<string, string | number> = {};
    if (params.category) clean['category'] = params.category;
    if (params.limit) clean['limit'] = params.limit;

    // Add location from header selection
    try {
      const locRaw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== DEFAULT_COUNTRY) {
          if (loc.province?._id) clean['provinceId'] = loc.province._id;
          if (loc.city?._id) clean['cityId'] = loc.city._id;
          if (loc.area?._id) clean['areaId'] = loc.area._id;
        }
      }
    } catch {}

    // Fallback to city name if passed directly
    if (!clean['cityId'] && params.city) clean['city'] = params.city;

    return this.api.get<ListingsResponse>(API.LISTINGS_FEATURED, clean);
  }

  getNearby(
    params: {
      provinceId?: string;
      cityId?: string;
      areaId?: string;
      limit?: number;
    } = {},
  ): Observable<ListingsResponse> {
    const query: Record<string, string | number> = {};
    if (params.provinceId) query['provinceId'] = params.provinceId;
    if (params.cityId) query['cityId'] = params.cityId;
    if (params.areaId) query['areaId'] = params.areaId;
    if (params.limit) query['limit'] = params.limit;
    return this.api.get<ListingsResponse>(API.LOCATION_NEARBY, query);
  }

  getByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 20,
    sort?: string,
    order?: 'asc' | 'desc',
  ): Observable<ListingsResponse> {
    const params: Record<string, string | number> = {
      categoryId,
      page,
      limit,
      sort: sort || 'createdAt',
      order: order || 'desc',
    };

    // Add location from header selection (only if user selected something specific)
    try {
      const locRaw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== DEFAULT_COUNTRY) {
          if (loc.province?._id) params['provinceId'] = loc.province._id;
          if (loc.city?._id) params['cityId'] = loc.city._id;
          if (loc.area?._id) params['areaId'] = loc.area._id;
        }
      }
    } catch {}

    return this.api.get<ListingsResponse>(API.LISTINGS, params);
  }

  getById(id: string): Observable<Listing> {
    return this.api.get<Listing>(API.LISTING_BY_ID(id));
  }

  getMyListings(page: number = 1, limit: number = 20): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>(API.LISTINGS, {
      mine: true,
      page,
      limit,
      sort: 'createdAt',
      order: 'desc',
    });
  }

  create(payload: CreateListingPayload): Observable<Listing> {
    return this.api.post<Listing>(API.LISTINGS, payload);
  }

  update(id: string, payload: Partial<CreateListingPayload>): Observable<Listing> {
    return this.api.patch<Listing>(API.LISTING_BY_ID(id), payload);
  }

  uploadMedia(listingId: string, formData: FormData): Observable<MediaUploadResponse> {
    return this.api.post<MediaUploadResponse>(API.LISTING_MEDIA(listingId), formData);
  }

  featureListing(id: string): Observable<Listing> {
    return this.api.post<Listing>(API.LISTING_FEATURE(id), {});
  }

  deleteListing(id: string, reason?: string): Observable<void> {
    return this.api.delete<void>(API.LISTING_BY_ID(id), { body: { reason } });
  }

  updateStatus(id: string, status: string): Observable<Listing> {
    return this.api.patch<Listing>(API.LISTING_STATUS(id), { status });
  }

  resubmitForReview(id: string): Observable<Listing> {
    return this.api.post<Listing>(API.LISTING_RESUBMIT(id), {});
  }

  getBySeller(sellerId: string, page = 1, limit = 50): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>(API.LISTINGS, {
      sellerId,
      page,
      limit,
      sort: 'createdAt',
      order: 'desc',
    });
  }
}
