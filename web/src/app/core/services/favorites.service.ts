import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Favorite } from '../models';
import { API } from '../constants/api-endpoints';

export interface FavoritesResponse {
  data: Favorite[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  constructor(private readonly api: ApiService) {}

  getAll(): Observable<any> {
    return this.api.get(API.FAVORITES);
  }

  add(productListingId: string): Observable<Favorite> {
    return this.api.post<Favorite>(API.FAVORITES, { productListingId });
  }

  remove(favoriteId: string): Observable<void> {
    return this.api.delete<void>(API.FAVORITE_BY_ID(favoriteId));
  }

  check(productListingId: string): Observable<{ isFavorited: boolean; favoriteId?: string }> {
    return this.api.get<{ isFavorited: boolean; favoriteId?: string }>(API.FAVORITES, {
      productListingId,
      check: true,
    });
  }
}
