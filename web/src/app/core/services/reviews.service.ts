import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Review } from '../models';
import { API } from '../constants/api-endpoints';

export interface ReviewsResponse {
  data: Review[];
  total: number;
  averageRating: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  constructor(private readonly api: ApiService) {}

  getByListing(listingId: string): Observable<ReviewsResponse> {
    return this.api.get<ReviewsResponse>(API.REVIEWS_BY_LISTING(listingId));
  }

  getBySeller(sellerId: string): Observable<ReviewsResponse> {
    return this.api.get<ReviewsResponse>(API.REVIEWS_BY_SELLER(sellerId));
  }

  /**
   * Submit a review. Sent as multipart/form-data so up to two optional photos
   * ride along; the browser sets the multipart boundary, so no Content-Type is
   * set by hand.
   */
  submit(review: {
    sellerId: string;
    rating: number;
    text: string;
    productListingId?: string;
    images?: File[];
  }): Observable<Review> {
    const fd = new FormData();
    fd.append('sellerId', review.sellerId);
    fd.append('rating', String(review.rating));
    fd.append('text', review.text);
    if (review.productListingId) {
      fd.append('productListingId', review.productListingId);
    }
    for (const file of review.images ?? []) {
      fd.append('images', file);
    }
    return this.api.post<Review>(API.REVIEWS, fd);
  }
}
