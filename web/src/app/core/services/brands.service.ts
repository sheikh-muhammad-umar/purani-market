import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Brand {
  _id: string;
  name: string;
  categoryId: string | { _id: string; name: string };
  logo?: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class BrandsService {
  constructor(private readonly api: ApiService) {}

  getByCategory(categoryId: string): Observable<Brand[]> {
    return this.api.get<Brand[]>('/brands', { categoryId });
  }

  getAll(includeInactive = false): Observable<Brand[]> {
    const params: Record<string, string> = {};
    if (includeInactive) params['all'] = 'true';
    return this.api.get<Brand[]>('/brands', params);
  }

  create(data: { name: string; categoryId: string }): Observable<Brand> {
    return this.api.post<Brand>('/brands', data);
  }

  update(id: string, data: Partial<{ name: string; isActive: boolean }>): Observable<Brand> {
    return this.api.patch<Brand>(`/brands/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/brands/${id}`);
  }
}
