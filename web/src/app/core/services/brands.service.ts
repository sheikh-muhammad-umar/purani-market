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

export interface VehicleModel {
  _id: string;
  name: string;
  brandId: string | { _id: string; name: string };
  categoryId: string;
  vehicleType: 'car' | 'bike';
  isActive: boolean;
}

export interface VehicleVariant {
  _id: string;
  name: string;
  modelId: string | { _id: string; name: string };
  brandId: string | { _id: string; name: string };
  categoryId: string;
  vehicleType: 'car' | 'bike';
  isActive: boolean;
}

export interface VehicleBrand {
  _id: string;
  name: string;
  categoryId: string | { _id: string; name: string };
  vehicleType: 'car' | 'bike';
  logo?: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class BrandsService {
  constructor(private readonly api: ApiService) {}

  // ── Brands ──

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

  // ── Vehicle Brands ──

  getVehicleBrandsByCategory(
    categoryId: string,
    includeInactive = false,
  ): Observable<VehicleBrand[]> {
    const params: Record<string, string> = { categoryId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleBrand[]>('/vehicle-brands', params);
  }

  getAllVehicleBrands(includeInactive = false): Observable<VehicleBrand[]> {
    const params: Record<string, string> = {};
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleBrand[]>('/vehicle-brands', params);
  }

  getVehicleBrandById(id: string): Observable<VehicleBrand> {
    return this.api.get<VehicleBrand>(`/vehicle-brands/${id}`);
  }

  createVehicleBrand(data: {
    name: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleBrand> {
    return this.api.post<VehicleBrand>('/vehicle-brands', data);
  }

  updateVehicleBrand(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleBrand> {
    return this.api.patch<VehicleBrand>(`/vehicle-brands/${id}`, data);
  }

  deleteVehicleBrand(id: string): Observable<void> {
    return this.api.delete<void>(`/vehicle-brands/${id}`);
  }

  // ── Vehicle Models ──

  getModelsByBrand(brandId: string, includeInactive = false): Observable<VehicleModel[]> {
    const params: Record<string, string> = { brandId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleModel[]>('/vehicle-models', params);
  }

  getModelsByCategory(categoryId: string): Observable<VehicleModel[]> {
    return this.api.get<VehicleModel[]>('/vehicle-models', { categoryId });
  }

  getModelById(id: string): Observable<VehicleModel> {
    return this.api.get<VehicleModel>(`/vehicle-models/${id}`);
  }

  createModel(data: {
    name: string;
    brandId: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleModel> {
    return this.api.post<VehicleModel>('/vehicle-models', data);
  }

  updateModel(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleModel> {
    return this.api.patch<VehicleModel>(`/vehicle-models/${id}`, data);
  }

  deleteModel(id: string): Observable<void> {
    return this.api.delete<void>(`/vehicle-models/${id}`);
  }

  bulkCreateModels(
    models: { name: string; brandId: string; categoryId: string }[],
  ): Observable<VehicleModel[]> {
    return this.api.post<VehicleModel[]>('/vehicle-models/bulk', models);
  }

  // ── Vehicle Variants ──

  getVariantsByModel(modelId: string, includeInactive = false): Observable<VehicleVariant[]> {
    const params: Record<string, string> = { modelId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleVariant[]>('/vehicle-variants', params);
  }

  getVariantsByBrand(brandId: string): Observable<VehicleVariant[]> {
    return this.api.get<VehicleVariant[]>('/vehicle-variants', { brandId });
  }

  getVariantById(id: string): Observable<VehicleVariant> {
    return this.api.get<VehicleVariant>(`/vehicle-variants/${id}`);
  }

  createVariant(data: {
    name: string;
    modelId: string;
    brandId: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleVariant> {
    return this.api.post<VehicleVariant>('/vehicle-variants', data);
  }

  updateVariant(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleVariant> {
    return this.api.patch<VehicleVariant>(`/vehicle-variants/${id}`, data);
  }

  deleteVariant(id: string): Observable<void> {
    return this.api.delete<void>(`/vehicle-variants/${id}`);
  }

  bulkCreateVariants(
    variants: { name: string; modelId: string; brandId: string; categoryId: string }[],
  ): Observable<VehicleVariant[]> {
    return this.api.post<VehicleVariant[]>('/vehicle-variants/bulk', variants);
  }
}
