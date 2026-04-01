export type PackageType = 'featured_ads' | 'ad_slots';
export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'card';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface CategoryPricing {
  categoryId: string;
  price: number;
}

export interface AdPackage {
  _id: string;
  name: string;
  type: PackageType;
  duration: 7 | 15 | 30;
  quantity: number;
  defaultPrice: number;
  categoryPricing: CategoryPricing[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PackagePurchase {
  _id: string;
  sellerId: string;
  packageId: string;
  categoryId?: string;
  type: PackageType;
  quantity: number;
  remainingQuantity: number;
  duration: number;
  price: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTransactionId: string;
  activatedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
