import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Review } from '../models';

export interface ReviewsResponse {
  data: Review[];
  total: number;
  averageRating: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  constructor(private readonly api: ApiService) {}

  getByListing(listingId: string): Observable<ReviewsResponse> {
    return this.api.get<ReviewsResponse>(`/reviews/listing/${listingId}`);
  }

  getBySeller(sellerId: string): Observable<ReviewsResponse> {
    return this.api.get<ReviewsResponse>(`/reviews/seller/${sellerId}`);
  }

  submit(review: { productListingId: string; rating: number; text: string }): Observable<Review> {
    return this.api.post<Review>('/reviews', review);
  }
}
