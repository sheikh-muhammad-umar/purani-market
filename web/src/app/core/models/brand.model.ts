/** Sentinel value for the "Other" option in brand/model/variant pickers */
export const OTHER_OPTION_ID = 'other';

/** Lightweight brand option used in dropdowns */
export interface BrandOption {
  _id: string;
  name: string;
}

export type VehicleType = 'car' | 'motorcycle';

export interface Brand {
  _id: string;
  name: string;
  categoryId: string | { _id: string; name: string };
  logo?: string;
  isActive: boolean;
}

export interface VehicleBrand {
  _id: string;
  name: string;
  categoryId: string | { _id: string; name: string };
  vehicleType: VehicleType;
  logo?: string;
  isActive: boolean;
}

export interface VehicleModel {
  _id: string;
  name: string;
  brandId: string | { _id: string; name: string };
  categoryId: string;
  vehicleType: VehicleType;
  isActive: boolean;
}

export interface VehicleVariant {
  _id: string;
  name: string;
  modelId: string | { _id: string; name: string };
  brandId: string | { _id: string; name: string };
  categoryId: string;
  vehicleType: VehicleType;
  isActive: boolean;
}
