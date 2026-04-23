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

  submit(review: { productListingId: string; rating: number; text: string }): Observable<Review> {
    return this.api.post<Review>(API.REVIEWS, review);
  }
}
