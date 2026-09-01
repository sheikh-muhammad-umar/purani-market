import {
  UserRole,
  UserStatus,
  ListingCondition,
  EntitlementKind,
  PackageType,
  PaymentMethod,
  PaymentStatus,
  CategoryAttributeType,
  SearchSortOption,
} from './enums';
import { PAYMENT_METHOD_CONFIG } from './app';
import { environment } from '../../../environments/environment';

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

export const CONDITION_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  ...CONDITION_OPTIONS,
];

// ─── Package ─────────────────────────────────────────────
export const PACKAGE_TYPE_OPTIONS: SelectOption[] = [
  { value: PackageType.FEATURED_ADS, label: 'Featured Ads' },
  { value: PackageType.AD_SLOTS, label: 'Ad Slots' },
  { value: PackageType.BUNDLE, label: 'All in One' },
];

/** The individual things a package can grant, for authoring an all-in-one. */
export const ENTITLEMENT_KIND_OPTIONS: SelectOption[] = [
  { value: EntitlementKind.AD_SLOTS, label: 'Ad slots' },
  { value: EntitlementKind.FEATURED_ADS, label: 'Featured ads' },
  { value: EntitlementKind.SHORTS, label: 'Shorts' },
];

export const PACKAGE_TYPE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  ...PACKAGE_TYPE_OPTIONS,
];

export const DURATION_OPTIONS: SelectOption[] = environment.packageDurations.map((d) => ({
  value: d,
  label: `${d} days`,
}));

export const SHORTS_DURATION_OPTIONS: SelectOption[] = environment.shortsPackageDurations.map(
  (d) => ({
    value: d,
    label: `${d} days`,
  }),
);

// ─── Payment ─────────────────────────────────────────────
export const PAYMENT_METHOD_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: PaymentMethod.JAZZCASH, label: PAYMENT_METHOD_CONFIG[PaymentMethod.JAZZCASH].label },
  { value: PaymentMethod.EASYPAISA, label: PAYMENT_METHOD_CONFIG[PaymentMethod.EASYPAISA].label },
  { value: PaymentMethod.CARD, label: PAYMENT_METHOD_CONFIG[PaymentMethod.CARD].label },
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

// ─── Moderation ──────────────────────────────────────────
export const REVIEW_COUNT_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: '0', label: 'First review' },
  { value: '1', label: 'Resubmitted (2nd)' },
  { value: '2', label: 'Resubmitted (3rd)' },
];

// ─── Activity Actions ────────────────────────────────────
export const ACTION_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Actions' },
  // Browsing
  { value: 'view', label: 'View Listing' },
  { value: 'search', label: 'Search' },
  { value: 'category_browse', label: 'Category Browse' },
  { value: 'page_view', label: 'Page View' },
  // Engagement
  { value: 'favorite', label: 'Favorite' },
  { value: 'unfavorite', label: 'Unfavorite' },
  { value: 'contact', label: 'Contact' },
  { value: 'share', label: 'Share' },
  // Listings
  { value: 'listing_create', label: 'Listing Create' },
  { value: 'listing_edit', label: 'Listing Edit' },
  { value: 'listing_delete', label: 'Listing Delete' },
  { value: 'listing_status_change', label: 'Status Change' },
  { value: 'listing_feature', label: 'Feature Ad' },
  { value: 'listing_price_change', label: 'Price Change' },
  { value: 'listing_expired', label: 'Listing Expired' },
  { value: 'listing_deactivated_cleanup', label: 'Listing Cleanup' },
  // Auth
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Login Failed' },
  { value: 'register', label: 'Register' },
  { value: 'logout', label: 'Logout' },
  { value: 'social_login', label: 'Social Login' },
  // OTP / Verification
  { value: 'otp_sent', label: 'OTP Sent' },
  { value: 'otp_verified', label: 'OTP Verified' },
  { value: 'otp_failed', label: 'OTP Failed' },
  { value: 'otp_resent', label: 'OTP Resent' },
  { value: 'otp_expired', label: 'OTP Expired' },
  { value: 'email_verified', label: 'Email Verified' },
  { value: 'phone_verified', label: 'Phone Verified' },
  { value: 'whatsapp_otp_sent', label: 'WhatsApp OTP Sent' },
  // Reviews
  { value: 'review_create', label: 'Review Create' },
  // Messaging
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'conversation_start', label: 'Conversation Start' },
  // Payments & Packages
  { value: 'package_purchase', label: 'Package Purchase' },
  { value: 'payment_attempt', label: 'Payment Attempt' },
  { value: 'package_apply_success', label: 'Package Applied' },
  { value: 'package_apply_failed', label: 'Package Apply Failed' },
  { value: 'package_expired', label: 'Package Expired' },
  { value: 'ad_slots_package_expired', label: 'Ad Slots Expired' },
  { value: 'stale_payment_failed', label: 'Stale Payment Failed' },
  // Packaged Listing Lifecycle
  { value: 'packaged_listing_deleted', label: 'Packaged Listing Deleted' },
  { value: 'packaged_listing_deactivated', label: 'Packaged Listing Deactivated' },
  { value: 'packaged_listing_sold', label: 'Packaged Listing Sold' },
  // Location
  { value: 'location_change', label: 'Location Change' },
  // Voice Search
  { value: 'voice_search_start', label: 'Voice Search Start' },
  { value: 'voice_search_complete', label: 'Voice Search Complete' },
  { value: 'voice_search_cancel', label: 'Voice Search Cancel' },
  { value: 'voice_search_error', label: 'Voice Search Error' },
  // AI
  { value: 'dismiss', label: 'Dismiss Recommendation' },
  { value: 'recommendation_click', label: 'Recommendation Click' },
  // App Banner
  { value: 'app_banner_shown', label: 'App Banner Shown' },
  { value: 'app_banner_click', label: 'App Banner Click' },
  { value: 'app_banner_dismiss', label: 'App Banner Dismiss' },
  // Shorts
  { value: 'short_uploaded', label: 'Short Uploaded' },
  { value: 'short_approved', label: 'Short Approved' },
  { value: 'short_rejected', label: 'Short Rejected' },
  { value: 'short_expired', label: 'Short Expired' },
  { value: 'short_deleted', label: 'Short Deleted' },
  { value: 'short_view', label: 'Short View' },
  { value: 'short_like', label: 'Short Like' },
  { value: 'short_unlike', label: 'Short Unlike' },
  { value: 'short_share', label: 'Short Share' },
  { value: 'short_chat_click', label: 'Short Chat Click' },
  { value: 'short_call_click', label: 'Short Call Click' },
  { value: 'short_limit_reached', label: 'Short Limit Reached' },
  { value: 'shorts_package_purchased', label: 'Shorts Package Purchased' },
  { value: 'shorts_package_expired', label: 'Shorts Package Expired' },
  // ID Verification
  { value: 'id_verification_submit', label: 'ID Verification Submit' },
  { value: 'admin_id_verification_approve', label: 'Admin: ID Approve' },
  { value: 'admin_id_verification_reject', label: 'Admin: ID Reject' },
  // Admin
  { value: 'admin_user_status_change', label: 'Admin: User Status' },
  { value: 'admin_user_role_change', label: 'Admin: User Role' },
  { value: 'admin_user_listing_limit_change', label: 'Admin: Listing Limit' },
  { value: 'admin_listing_approve', label: 'Admin: Approve Listing' },
  { value: 'admin_listing_reject', label: 'Admin: Reject Listing' },
  { value: 'admin_category_create', label: 'Admin: Create Category' },
  { value: 'admin_category_update', label: 'Admin: Update Category' },
  { value: 'admin_category_delete', label: 'Admin: Delete Category' },
  { value: 'admin_category_attributes_update', label: 'Admin: Update Attributes' },
  { value: 'admin_category_features_update', label: 'Admin: Update Features' },
  { value: 'admin_location_create', label: 'Admin: Create Location' },
  { value: 'admin_location_update', label: 'Admin: Update Location' },
  { value: 'admin_location_delete', label: 'Admin: Delete Location' },
  { value: 'admin_package_create', label: 'Admin: Create Package' },
  { value: 'admin_package_update', label: 'Admin: Update Package' },
  { value: 'admin_notification_send', label: 'Admin: Send Notification' },
  { value: 'admin_export_report', label: 'Admin: Export Report' },
  { value: 'admin_rejection_reason_create', label: 'Admin: Create Rejection Reason' },
  { value: 'admin_rejection_reason_update', label: 'Admin: Update Rejection Reason' },
  { value: 'admin_rejection_reason_delete', label: 'Admin: Delete Rejection Reason' },
];
