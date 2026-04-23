import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';
import { API } from '../constants/api-endpoints';

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
  constructor(private readonly api: ApiService) {}

  getRecommendations(limit: number = 20): Observable<Listing[]> {
    return this.api.get<Listing[]>(API.RECOMMENDATIONS, { limit });
  }

  dismiss(listingId: string): Observable<void> {
    return this.api.post<void>(API.RECOMMENDATIONS_DISMISS, { listingId });
  }
}
