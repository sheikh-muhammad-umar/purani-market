export type PackageType = 'featured_ads' | 'ad_slots' | 'bundle';

/** What a package grants. `bundle` packages grant more than one kind. */
export type EntitlementKind = 'ad_slots' | 'featured_ads' | 'shorts';

export interface EntitlementGrant {
  kind: EntitlementKind;
  quantity: number;
}

export interface EntitlementBalance extends EntitlementGrant {
  remaining: number;
}
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
  /** Whitelisted server-side; the allowed set is environment-driven. */
  duration: number;
  /** Total across every entitlement. Per-kind amounts live in `entitlements`. */
  quantity: number;
  /** Empty on single-purpose packages, where `type` and `quantity` say it all. */
  entitlements?: EntitlementGrant[];
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
  /** Which side of the shared collection this row belongs to. */
  purchaseType?: 'ads' | 'shorts';
  categoryId?: string;
  type: PackageType;
  quantity: number;
  remainingQuantity: number;
  /** Per-kind balances on a bundle purchase; empty on single-purpose ones. */
  entitlements?: EntitlementBalance[];
  duration: number;
  price: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTransactionId: string;
  activatedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Set when an admin withdrew the purchase; money moves in the gateway portal. */
  refundedAt?: Date;
  refundReason?: string;
  refundedBy?: string;
}
