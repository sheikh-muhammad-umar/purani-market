// ─── User ────────────────────────────────────────────────
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

// ─── Listing ─────────────────────────────────────────────
export enum ListingCondition {
  NEW = 'new',
  USED = 'used',
  REFURBISHED = 'refurbished',
}

export enum ListingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected',
  SOLD = 'sold',
  RESERVED = 'reserved',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

// ─── Package / Payment ──────────────────────────────────
export enum PackageType {
  FEATURED_ADS = 'featured_ads',
  AD_SLOTS = 'ad_slots',
}

export enum PaymentMethod {
  JAZZCASH = 'jazzcash',
  EASYPAISA = 'easypaisa',
  CARD = 'card',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ─── Review ──────────────────────────────────────────────
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// ─── Category Attribute ──────────────────────────────────
export enum CategoryAttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  BOOLEAN = 'boolean',
  RANGE = 'range',
  YEAR = 'year',
  PROVINCE_CITY = 'province_city',
}

// ─── Search ──────────────────────────────────────────────
export enum SearchSortOption {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
}

// ─── Social Provider ─────────────────────────────────────
export enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}
