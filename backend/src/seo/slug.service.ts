import { Injectable } from '@nestjs/common';
import { ProductListing } from '../listings/schemas/product-listing.schema.js';
import { Category } from '../categories/schemas/category.schema.js';
import {
  SEO_DEFAULT_SLUG_FALLBACK,
  SEO_ROUTE_PATTERNS,
} from '../common/constants/index.js';

/**
 * Tracking and pagination parameters that should be stripped from canonical URLs.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'fbclid',
  'gclid',
  'page',
  'offset',
]);

@Injectable()
export class SlugService {
  /**
   * Generate a URL-safe slug from a title string.
   *
   * Handles Urdu text and other non-ASCII characters by omitting them.
   * Output contains only lowercase alphanumeric characters and hyphens,
   * with no leading, trailing, or consecutive hyphens.
   *
   * If the input produces an empty slug (e.g. only Urdu or special chars),
   * defaults to "listing".
   */
  generateSlug(title: string): string {
    if (!title) {
      return SEO_DEFAULT_SLUG_FALLBACK;
    }

    const slug = title
      // Normalize unicode (decompose accented characters)
      .normalize('NFD')
      // Remove combining diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Convert to lowercase
      .toLowerCase()
      // Replace any non-alphanumeric character (including non-Latin) with a hyphen
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading hyphens
      .replace(/^-+/, '')
      // Remove trailing hyphens
      .replace(/-+$/, '');

    return slug || SEO_DEFAULT_SLUG_FALLBACK;
  }

  /**
   * Generate a listing URL in the pattern `/listings/{slug}-{id}`.
   */
  generateListingUrl(listing: Pick<ProductListing, '_id' | 'title'>): string {
    const slug = this.generateSlug(listing.title);
    const id = listing._id.toString();
    return `${SEO_ROUTE_PATTERNS.LISTING}/${slug}-${id}`;
  }

  /**
   * Generate a category URL in the pattern `/categories/{slug}`.
   */
  generateCategoryUrl(category: Pick<Category, 'slug'>): string {
    return `${SEO_ROUTE_PATTERNS.CATEGORY}/${category.slug}`;
  }

  /**
   * Generate a seller URL in the pattern `/seller/{id}`.
   */
  generateSellerUrl(sellerId: string): string {
    return `${SEO_ROUTE_PATTERNS.SELLER}/${sellerId}`;
  }

  /**
   * Strip tracking and pagination parameters from a URL while preserving
   * content-relevant parameters.
   *
   * Removes: utm_source, utm_medium, utm_campaign, fbclid, gclid, page, offset
   */
  stripTrackingParams(url: string): string {
    try {
      // Handle both absolute and relative URLs
      const isRelative = url.startsWith('/');
      const base = isRelative ? 'https://placeholder.local' : undefined;
      const parsed = new URL(url, base);

      const keysToDelete: string[] = [];
      parsed.searchParams.forEach((_value, key) => {
        if (TRACKING_PARAMS.has(key)) {
          keysToDelete.push(key);
        }
      });

      for (const key of keysToDelete) {
        parsed.searchParams.delete(key);
      }

      if (isRelative) {
        const search = parsed.search;
        return `${parsed.pathname}${search}`;
      }

      return parsed.toString();
    } catch {
      // If URL parsing fails, return the original URL
      return url;
    }
  }
}
