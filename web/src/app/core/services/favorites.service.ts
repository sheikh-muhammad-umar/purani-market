import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Favorite } from '../models';

export interface FavoritesResponse {
  data: Favorite[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  constructor(private readonly api: ApiService) {}

  getAll(): Observable<any> {
    return this.api.get('/favorites');
  }

  add(productListingId: string): Observable<Favorite> {
    return this.api.post<Favorite>('/favorites', { productListingId });
  }

  remove(favoriteId: string): Observable<void> {
    return this.api.delete<void>(`/favorites/${favoriteId}`);
  }

  check(productListingId: string): Observable<{ isFavorited: boolean; favoriteId?: string }> {
    return this.api.get<{ isFavorited: boolean; favoriteId?: string }>('/favorites', {
      productListingId,
      check: true,
    });
  }
}
