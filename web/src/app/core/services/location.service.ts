import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { Province, City, Area } from '../models';
import { API } from '../constants/api-endpoints';

@Injectable({ providedIn: 'root' })
export class LocationService {
  /** Cached provinces — rarely changes, shared across all subscribers */
  private provincesCache$: Observable<Province[]> | null = null;

  constructor(private readonly api: ApiService) {}

  getProvinces(): Observable<Province[]> {
    if (!this.provincesCache$) {
      this.provincesCache$ = this.api
        .get<Province[]>(API.LOCATION_PROVINCES)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.provincesCache$;
  }

  getCities(provinceId: string): Observable<City[]> {
    return this.api.get<City[]>(API.LOCATION_CITIES(provinceId));
  }

  getAreas(cityId: string): Observable<Area[]> {
    return this.api.get<Area[]>(API.LOCATION_AREAS(cityId));
  }
}
