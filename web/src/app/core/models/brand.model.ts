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
  vehicleType: 'car' | 'bike';
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
