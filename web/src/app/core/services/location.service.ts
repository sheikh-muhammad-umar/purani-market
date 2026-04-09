import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Province, City, Area } from '../models';

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private readonly api: ApiService) {}

  getProvinces(): Observable<Province[]> {
    return this.api.get<Province[]>('/location/provinces');
  }

  getCities(provinceId: string): Observable<City[]> {
    return this.api.get<City[]>(`/location/provinces/${provinceId}/cities`);
  }

  getAreas(cityId: string): Observable<Area[]> {
    return this.api.get<Area[]>(`/location/cities/${cityId}/areas`);
  }
}
