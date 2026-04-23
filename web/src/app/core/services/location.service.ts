import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Province, City, Area } from '../models';
import { API } from '../constants/api-endpoints';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private readonly api: ApiService) {}

  getProvinces(): Observable<Province[]> {
    return this.api.get<Province[]>(API.LOCATION_PROVINCES);
  }

  getCities(provinceId: string): Observable<City[]> {
    return this.api.get<City[]>(API.LOCATION_CITIES(provinceId));
  }

  getAreas(cityId: string): Observable<Area[]> {
    return this.api.get<Area[]>(API.LOCATION_AREAS(cityId));
  }
}
