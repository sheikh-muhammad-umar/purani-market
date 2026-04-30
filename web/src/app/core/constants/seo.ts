/** Frontend SEO constants shared across services and resolvers. */

import { environment } from '../../../environments/environment';

export const SEO_BASE_URL = environment.seoBaseUrl;
export const SEO_SITE_NAME = environment.seoSiteName;
export const SEO_PLACEHOLDER_IMAGE = `${SEO_BASE_URL}/assets/placeholder.png`;
export const SEO_DEFAULT_TITLE = SEO_SITE_NAME;
export const SEO_DEFAULT_DESCRIPTION = `Buy and sell new & used products in Pakistan. Find the best deals on ${SEO_SITE_NAME}.`;

/** Timeout (ms) applied to SEO API calls during SSR to prevent blocking. */
export const SEO_SSR_TIMEOUT_MS = 2000;

/** Hreflang language codes injected on every public page. */
export const SEO_HREFLANG_VALUES = ['en', 'ur', 'x-default'] as const;

/** Default page size used for pagination link calculations. */
export const SEO_CATEGORY_PAGE_SIZE = 20;
