export type ListingCondition = 'new' | 'used' | 'refurbished';
export type ListingStatus =
  | 'active'
  | 'inactive'
  | 'pending_review'
  | 'rejected'
  | 'sold'
  | 'reserved'
  | 'expired'
  | 'deleted';

export interface ListingPrice {
  amount: number;
  currency: string;
}

export interface ListingImage {
  url: string;
  thumbnailUrl: string;
  sortOrder: number;
}

export interface ListingVideo {
  url: string;
  thumbnailUrl: string;
}

export interface ListingLocation {
  provinceId?: string;
  cityId?: string;
  areaId?: string;
  province?: string;
  city: string;
  area?: string;
  blockPhase?: string;
  mapLink?: string;
}

export interface ListingContactInfo {
  phone: string;
  email: string;
}

export interface Listing {
  _id: string;
  sellerId: string;
  title: string;
  description: string;
  price: ListingPrice;
  categoryId: string;
  categoryPath: string[];
  condition: ListingCondition;
  brandId?: string;
  brandName?: string;
  vehicleBrandId?: string;
  vehicleBrandName?: string;
  modelId?: string;
  modelName?: string;
  variantId?: string;
  variantName?: string;
  categoryAttributes: Record<string, unknown>;
  selectedFeatures: string[];
  images: ListingImage[];
  video?: ListingVideo;
  location: ListingLocation;
  contactInfo: ListingContactInfo;
  status: ListingStatus;
  isFeatured: boolean;
  featuredUntil?: Date;
  rejectionReason?: string;
  rejectionCount?: number;
  viewCount: number;
  favoriteCount: number;
  deletedAt?: Date;
  expiresAt?: Date;
  deactivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  sellerEmailVerified?: boolean;
  sellerPhoneVerified?: boolean;
  sellerIdVerified?: boolean;
  sellerName?: string;
  sellerActiveAdsCount?: number;
  sellerResponseRate?: number;
  sellerAvgResponseTime?: string;
  purchaseId?:
    | string
    | { _id: string; packageId?: { name: string; type: string }; remainingQuantity?: number };
}
