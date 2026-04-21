import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';

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
  categoryAttributes: Record<string, unknown>;
  selectedFeatures?: string[];
  location: {
    provinceId?: string; cityId?: string; areaId?: string;
    city?: string; province?: string; area?: string;
    blockPhase?: string; coordinates?: [number, number];
  };
  contactInfo?: { phone: string; email: string };
  isFeatured?: boolean;
}

export interface MediaUploadResponse {
  url: string;
  thumbnailUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ListingsService {
  constructor(private readonly api: ApiService) {}

  getFeatured(limit: number = 10): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>('/listings/featured', { limit });
  }

  getFeaturedFiltered(params: { category?: string; city?: string; limit?: number } = {}): Observable<ListingsResponse> {
    const clean: Record<string, string | number> = {};
    if (params.category) clean['category'] = params.category;
    if (params.limit) clean['limit'] = params.limit;

    // Add location from header selection
    try {
      const locRaw = localStorage.getItem('selected_location');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== 'Pakistan') {
          if (loc.province?._id) clean['provinceId'] = loc.province._id;
          if (loc.city?._id) clean['cityId'] = loc.city._id;
          if (loc.area?._id) clean['areaId'] = loc.area._id;
        }
      }
    } catch {}

    // Fallback to city name if passed directly
    if (!clean['cityId'] && params.city) clean['city'] = params.city;

    return this.api.get<ListingsResponse>('/listings/featured', clean);
  }

  getNearby(lat: number, lng: number, radius: number = 25, limit: number = 12): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>('/listings', {
      lat,
      lng,
      radius,
      limit,
      sort: 'distance',
    });
  }

  getByCategory(categoryId: string, page: number = 1, limit: number = 20, sort?: string, order?: 'asc' | 'desc'): Observable<ListingsResponse> {
    const params: Record<string, string | number> = {
      categoryId,
      page,
      limit,
      sort: sort || 'createdAt',
      order: order || 'desc',
    };

    // Add location from header selection (only if user selected something specific)
    try {
      const locRaw = localStorage.getItem('selected_location');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== 'Pakistan') {
          if (loc.province?._id) params['provinceId'] = loc.province._id;
          if (loc.city?._id) params['cityId'] = loc.city._id;
          if (loc.area?._id) params['areaId'] = loc.area._id;
        }
      }
    } catch {}

    return this.api.get<ListingsResponse>('/listings', params);
  }

  getById(id: string): Observable<Listing> {
    return this.api.get<Listing>(`/listings/${id}`);
  }

  getMyListings(page: number = 1, limit: number = 20): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>('/listings', {
      mine: true,
      page,
      limit,
      sort: 'createdAt',
      order: 'desc',
    });
  }

  create(payload: CreateListingPayload): Observable<Listing> {
    return this.api.post<Listing>('/listings', payload);
  }

  update(id: string, payload: Partial<CreateListingPayload>): Observable<Listing> {
    return this.api.patch<Listing>(`/listings/${id}`, payload);
  }

  uploadMedia(listingId: string, formData: FormData): Observable<MediaUploadResponse> {
    return this.api.post<MediaUploadResponse>(`/listings/${listingId}/media`, formData);
  }

  featureListing(id: string): Observable<Listing> {
    return this.api.post<Listing>(`/listings/${id}/feature`, {});
  }

  deleteListing(id: string): Observable<void> {
    return this.api.delete<void>(`/listings/${id}`);
  }

  updateStatus(id: string, status: string): Observable<Listing> {
    return this.api.patch<Listing>(`/listings/${id}/status`, { status });
  }

  resubmitForReview(id: string): Observable<Listing> {
    return this.api.post<Listing>(`/listings/${id}/resubmit`, {});
  }

  getBySeller(sellerId: string, page = 1, limit = 50): Observable<ListingsResponse> {
    return this.api.get<ListingsResponse>('/listings', { sellerId, page, limit, sort: 'createdAt', order: 'desc' });
  }
}
