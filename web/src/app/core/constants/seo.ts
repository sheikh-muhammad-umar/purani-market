/** Frontend SEO constants shared across services and resolvers. */

import { environment } from '../../../environments/environment';

export const SEO_BASE_URL = environment.seoBaseUrl;
export const SEO_SITE_NAME = environment.seoSiteName;
export const SEO_PLACEHOLDER_IMAGE = `${SEO_BASE_URL}/assets/placeholder.png`;
export const SEO_DEFAULT_TITLE = SEO_SITE_NAME;
export const SEO_DEFAULT_DESCRIPTION = `Buy and sell new & used products in Pakistan. Find the best deals on ${SEO_SITE_NAME}.`;

/** Timeout (ms) applied to SEO API calls during SSR to prevent blocking. */
export const SEO_SSR_TIMEOUT_MS = 2000;

/**
 * Hreflang codes injected on every public page.
 *
 * English only, because the site has no translated pages — no locale files, no
 * @angular/localize, no language switcher. An `ur` alternate was previously
 * emitted pointing at the English URL, which told search engines an Urdu version
 * existed at an address that serves English. Add a code here only once real pages
 * exist to point it at.
 */
export const SEO_HREFLANG_VALUES = ['en', 'x-default'] as const;
