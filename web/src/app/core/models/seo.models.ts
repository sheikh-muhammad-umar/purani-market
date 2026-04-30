// ── Frontend SEO configuration interfaces ──

/** Supported Open Graph page types. */
export type OgType = 'website' | 'product' | 'profile';

/** Supported Twitter Card types. */
export type TwitterCardType = 'summary' | 'summary_large_image';

export interface PageMetaConfig {
  title: string;
  description: string;
  imageUrl?: string;
  canonicalUrl: string;
  ogType?: OgType;
  twitterCard?: TwitterCardType;
}

export interface OpenGraphConfig {
  title: string;
  description: string;
  image: string;
  url: string;
  type: OgType;
  siteName: string;
}

export interface TwitterCardConfig {
  card: TwitterCardType;
  title: string;
  description: string;
  image: string;
}

/** Configuration for rel="next" / rel="prev" pagination link elements. */
export interface PaginationLinksConfig {
  nextUrl?: string;
  prevUrl?: string;
}

// ── SEO API response interfaces (mirror backend DTOs) ──

export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}

export interface ListingSeoResponse {
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  currency: string;
  categoryBreadcrumb: BreadcrumbItem[];
  sellerName: string;
  averageRating: number | null;
  reviewCount: number;
  canonicalUrl: string;
  productJsonLd: Record<string, unknown>;
  breadcrumbJsonLd: Record<string, unknown>;
}

export interface CategorySeoResponse {
  title: string;
  description: string;
  breadcrumb: BreadcrumbItem[];
  listingCount: number;
  canonicalUrl: string;
  itemListJsonLd: Record<string, unknown>;
  breadcrumbJsonLd: Record<string, unknown>;
}

export interface SellerSeoResponse {
  title: string;
  description: string;
  avatarUrl: string;
  city: string;
  memberSince: string;
  isVerified: boolean;
  activeListingCount: number;
  canonicalUrl: string;
  personJsonLd: Record<string, unknown>;
}

export interface SearchSeoResponse {
  title: string;
  description: string;
  canonicalUrl: string;
}

export interface PageSeoResponse {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: OgType;
  faqJsonLd?: Record<string, unknown>;
}

export interface HomeSeoResponse {
  title: string;
  description: string;
  featuredCategories: string[];
  canonicalUrl: string;
  websiteJsonLd: Record<string, unknown>;
  organizationJsonLd: Record<string, unknown>;
}
