import {
  UserRole,
  UserStatus,
  ListingCondition,
  PackageType,
  PaymentMethod,
  PaymentStatus,
  CategoryAttributeType,
  SearchSortOption,
} from './enums';

export interface SelectOption {
  value: string | number;
  label: string;
}

// ─── User ────────────────────────────────────────────────
export const ROLE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Roles' },
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.USER, label: 'User' },
];

export const ROLE_CHANGE_OPTIONS: SelectOption[] = [
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.USER, label: 'User' },
];

export const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Status' },
  { value: UserStatus.ACTIVE, label: 'Active' },
  { value: UserStatus.SUSPENDED, label: 'Suspended' },
];

// ─── Listing ─────────────────────────────────────────────
export const CONDITION_OPTIONS: SelectOption[] = [
  { value: ListingCondition.NEW, label: 'New' },
  { value: ListingCondition.USED, label: 'Used' },
  { value: ListingCondition.REFURBISHED, label: 'Refurbished' },
];

// ─── Package ─────────────────────────────────────────────
export const PACKAGE_TYPE_OPTIONS: SelectOption[] = [
  { value: PackageType.FEATURED_ADS, label: 'Featured Ads' },
  { value: PackageType.AD_SLOTS, label: 'Ad Slots' },
];

export const PACKAGE_TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  ...PACKAGE_TYPE_OPTIONS,
];

export const DURATION_OPTIONS: SelectOption[] = [
  { value: 7, label: '7 days' },
  { value: 15, label: '15 days' },
  { value: 30, label: '30 days' },
];

// ─── Payment ─────────────────────────────────────────────
export const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: PaymentMethod.JAZZCASH, label: 'JazzCash' },
  { value: PaymentMethod.EASYPAISA, label: 'EasyPaisa' },
  { value: PaymentMethod.CARD, label: 'Card' },
];

export const PAYMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: PaymentStatus.PENDING, label: 'Pending' },
  { value: PaymentStatus.COMPLETED, label: 'Completed' },
  { value: PaymentStatus.FAILED, label: 'Failed' },
  { value: PaymentStatus.REFUNDED, label: 'Refunded' },
];

// ─── Category Attribute ──────────────────────────────────
export const ATTRIBUTE_TYPE_OPTIONS: SelectOption[] = [
  { value: CategoryAttributeType.TEXT, label: 'Text' },
  { value: CategoryAttributeType.NUMBER, label: 'Number' },
  { value: CategoryAttributeType.SELECT, label: 'Select' },
  { value: CategoryAttributeType.MULTISELECT, label: 'Multiselect' },
  { value: CategoryAttributeType.BOOLEAN, label: 'Boolean' },
  { value: CategoryAttributeType.RANGE, label: 'Range' },
  { value: CategoryAttributeType.YEAR, label: 'Year' },
  { value: CategoryAttributeType.PROVINCE_CITY, label: 'Province / City' },
];

// ─── Search ──────────────────────────────────────────────
export const SORT_OPTIONS: { value: SearchSortOption; label: string }[] = [
  { value: SearchSortOption.RELEVANCE, label: 'Relevance' },
  { value: SearchSortOption.PRICE_ASC, label: 'Price: Low to High' },
  { value: SearchSortOption.PRICE_DESC, label: 'Price: High to Low' },
  { value: SearchSortOption.NEWEST, label: 'Newest First' },
];
