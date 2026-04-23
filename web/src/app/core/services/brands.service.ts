import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Brand, VehicleBrand, VehicleModel, VehicleVariant } from '../models/brand.model';
import { API } from '../constants/api-endpoints';

export type { Brand, VehicleBrand, VehicleModel, VehicleVariant } from '../models/brand.model';
@Injectable({ providedIn: 'root' })
export class BrandsService {
  constructor(private readonly api: ApiService) {}

  // ── Brands ──

  getByCategory(categoryId: string): Observable<Brand[]> {
    return this.api.get<Brand[]>(API.BRANDS, { categoryId });
  }

  getAll(includeInactive = false): Observable<Brand[]> {
    const params: Record<string, string> = {};
    if (includeInactive) params['all'] = 'true';
    return this.api.get<Brand[]>(API.BRANDS, params);
  }

  create(data: { name: string; categoryId: string }): Observable<Brand> {
    return this.api.post<Brand>(API.BRANDS, data);
  }

  update(id: string, data: Partial<{ name: string; isActive: boolean }>): Observable<Brand> {
    return this.api.patch<Brand>(API.BRAND_BY_ID(id), data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(API.BRAND_BY_ID(id));
  }

  // ── Vehicle Brands ──

  getVehicleBrandsByCategory(
    categoryId: string,
    includeInactive = false,
  ): Observable<VehicleBrand[]> {
    const params: Record<string, string> = { categoryId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleBrand[]>(API.VEHICLE_BRANDS, params);
  }

  getAllVehicleBrands(includeInactive = false): Observable<VehicleBrand[]> {
    const params: Record<string, string> = {};
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleBrand[]>(API.VEHICLE_BRANDS, params);
  }

  getVehicleBrandById(id: string): Observable<VehicleBrand> {
    return this.api.get<VehicleBrand>(API.VEHICLE_BRAND_BY_ID(id));
  }

  createVehicleBrand(data: {
    name: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleBrand> {
    return this.api.post<VehicleBrand>(API.VEHICLE_BRANDS, data);
  }

  updateVehicleBrand(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleBrand> {
    return this.api.patch<VehicleBrand>(API.VEHICLE_BRAND_BY_ID(id), data);
  }

  deleteVehicleBrand(id: string): Observable<void> {
    return this.api.delete<void>(API.VEHICLE_BRAND_BY_ID(id));
  }

  // ── Vehicle Models ──

  getModelsByBrand(brandId: string, includeInactive = false): Observable<VehicleModel[]> {
    const params: Record<string, string> = { brandId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleModel[]>(API.VEHICLE_MODELS, params);
  }

  getModelsByCategory(categoryId: string): Observable<VehicleModel[]> {
    return this.api.get<VehicleModel[]>(API.VEHICLE_MODELS, { categoryId });
  }

  getModelById(id: string): Observable<VehicleModel> {
    return this.api.get<VehicleModel>(API.VEHICLE_MODEL_BY_ID(id));
  }

  createModel(data: {
    name: string;
    brandId: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleModel> {
    return this.api.post<VehicleModel>(API.VEHICLE_MODELS, data);
  }

  updateModel(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleModel> {
    return this.api.patch<VehicleModel>(API.VEHICLE_MODEL_BY_ID(id), data);
  }

  deleteModel(id: string): Observable<void> {
    return this.api.delete<void>(API.VEHICLE_MODEL_BY_ID(id));
  }

  bulkCreateModels(
    models: { name: string; brandId: string; categoryId: string }[],
  ): Observable<VehicleModel[]> {
    return this.api.post<VehicleModel[]>(API.VEHICLE_MODELS_BULK, models);
  }

  // ── Vehicle Variants ──

  getVariantsByModel(modelId: string, includeInactive = false): Observable<VehicleVariant[]> {
    const params: Record<string, string> = { modelId };
    if (includeInactive) params['all'] = 'true';
    return this.api.get<VehicleVariant[]>(API.VEHICLE_VARIANTS, params);
  }

  getVariantsByBrand(brandId: string): Observable<VehicleVariant[]> {
    return this.api.get<VehicleVariant[]>(API.VEHICLE_VARIANTS, { brandId });
  }

  getVariantById(id: string): Observable<VehicleVariant> {
    return this.api.get<VehicleVariant>(API.VEHICLE_VARIANT_BY_ID(id));
  }

  createVariant(data: {
    name: string;
    modelId: string;
    brandId: string;
    categoryId: string;
    vehicleType: 'car' | 'bike';
  }): Observable<VehicleVariant> {
    return this.api.post<VehicleVariant>(API.VEHICLE_VARIANTS, data);
  }

  updateVariant(
    id: string,
    data: Partial<{ name: string; isActive: boolean }>,
  ): Observable<VehicleVariant> {
    return this.api.patch<VehicleVariant>(API.VEHICLE_VARIANT_BY_ID(id), data);
  }

  deleteVariant(id: string): Observable<void> {
    return this.api.delete<void>(API.VEHICLE_VARIANT_BY_ID(id));
  }

  bulkCreateVariants(
    variants: { name: string; modelId: string; brandId: string; categoryId: string }[],
  ): Observable<VehicleVariant[]> {
    return this.api.post<VehicleVariant[]>(API.VEHICLE_VARIANTS_BULK, variants);
  }
}
