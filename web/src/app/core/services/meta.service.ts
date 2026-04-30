import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import {
  PageMetaConfig,
  OpenGraphConfig,
  TwitterCardConfig,
  PaginationLinksConfig,
} from '../models/seo.models';
import {
  SEO_PLACEHOLDER_IMAGE,
  SEO_SITE_NAME,
  SEO_DEFAULT_TITLE,
  SEO_DEFAULT_DESCRIPTION,
  SEO_BASE_URL,
  SEO_HREFLANG_VALUES,
} from '../constants/seo';

/**
 * Manages HTML `<head>` meta tags, Open Graph tags, Twitter Card tags,
 * and the canonical `<link>` element. Designed to run during SSR so that
 * crawlers and social-media scrapers receive complete metadata.
 */
@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly doc = inject(DOCUMENT);

  /**
   * Convenience method that sets the page title, description meta tag,
   * canonical URL, Open Graph tags, and Twitter Card tags in one call.
   */
  setPageMeta(config: PageMetaConfig): void {
    this.title.setTitle(config.title);
    this.meta.updateTag({ name: 'description', content: config.description });

    this.setCanonicalUrl(config.canonicalUrl);

    const image = config.imageUrl || SEO_PLACEHOLDER_IMAGE;

    this.setOpenGraphTags({
      title: config.title,
      description: config.description,
      image,
      url: config.canonicalUrl,
      type: config.ogType ?? 'website',
      siteName: SEO_SITE_NAME,
    });

    this.setTwitterCardTags({
      card: config.twitterCard ?? 'summary',
      title: config.title,
      description: config.description,
      image,
    });
  }

  /** Set all Open Graph meta tags. Uses placeholder image when `image` is empty. */
  setOpenGraphTags(config: OpenGraphConfig): void {
    const image = config.image || SEO_PLACEHOLDER_IMAGE;
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: config.url });
    this.meta.updateTag({ property: 'og:type', content: config.type });
    this.meta.updateTag({ property: 'og:site_name', content: config.siteName });
  }

  /** Set all Twitter Card meta tags. Uses placeholder image when `image` is empty. */
  setTwitterCardTags(config: TwitterCardConfig): void {
    const image = config.image || SEO_PLACEHOLDER_IMAGE;
    this.meta.updateTag({ name: 'twitter:card', content: config.card });
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
  }

  /** Create or update the `<link rel="canonical">` element in the document head. */
  setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.doc.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Set generic fallback meta tags when page-specific data is unavailable. */
  setFallbackMeta(): void {
    this.title.setTitle(SEO_DEFAULT_TITLE);
    this.meta.updateTag({ name: 'description', content: SEO_DEFAULT_DESCRIPTION });

    this.setOpenGraphTags({
      title: SEO_DEFAULT_TITLE,
      description: SEO_DEFAULT_DESCRIPTION,
      image: SEO_PLACEHOLDER_IMAGE,
      url: SEO_BASE_URL,
      type: 'website',
      siteName: SEO_SITE_NAME,
    });

    this.setTwitterCardTags({
      card: 'summary',
      title: SEO_DEFAULT_TITLE,
      description: SEO_DEFAULT_DESCRIPTION,
      image: SEO_PLACEHOLDER_IMAGE,
    });
  }

  /**
   * Set OG and product price meta tags for product listings.
   * Guards against undefined, null, or zero amounts — no tags are set in those cases.
   */
  setProductPriceTags(amount: number | undefined | null, currency: string): void {
    if (amount === undefined || amount === null || amount === 0) {
      return;
    }

    const amountStr = String(amount);
    this.meta.updateTag({ property: 'og:price:amount', content: amountStr });
    this.meta.updateTag({ property: 'og:price:currency', content: currency });
    this.meta.updateTag({ property: 'product:price:amount', content: amountStr });
    this.meta.updateTag({ property: 'product:price:currency', content: currency });
  }

  /** Remove all OG and product price meta tags (for non-product pages). */
  removeProductPriceTags(): void {
    this.meta.removeTag('property="og:price:amount"');
    this.meta.removeTag('property="og:price:currency"');
    this.meta.removeTag('property="product:price:amount"');
    this.meta.removeTag('property="product:price:currency"');
  }

  /**
   * Set rel="next" and/or rel="prev" pagination link elements.
   * Removes any stale pagination links before injecting new ones.
   */
  setPaginationLinks(config: PaginationLinksConfig): void {
    this.removePaginationLinks();

    if (config.nextUrl) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'next');
      link.setAttribute('href', config.nextUrl);
      this.doc.head.appendChild(link);
    }

    if (config.prevUrl) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'prev');
      link.setAttribute('href', config.prevUrl);
      this.doc.head.appendChild(link);
    }
  }

  /** Remove all rel="next" and rel="prev" pagination link elements. */
  removePaginationLinks(): void {
    const nextLinks = this.doc.querySelectorAll('link[rel="next"]');
    nextLinks.forEach((el) => el.remove());

    const prevLinks = this.doc.querySelectorAll('link[rel="prev"]');
    prevLinks.forEach((el) => el.remove());
  }

  /**
   * Inject or update `<link rel="alternate">` elements for hreflang tags.
   * Creates three links: hreflang="en", hreflang="ur", and hreflang="x-default",
   * all pointing to the provided canonical URL.
   * Ensures no duplicates are created on repeated calls.
   */
  setHreflangTags(canonicalUrl: string): void {
    for (const lang of SEO_HREFLANG_VALUES) {
      let link: HTMLLinkElement | null = this.doc.querySelector(
        `link[rel="alternate"][hreflang="${lang}"]`,
      );
      if (!link) {
        link = this.doc.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', lang);
        this.doc.head.appendChild(link);
      }
      link.setAttribute('href', canonicalUrl);
    }
  }

  /** Remove all hreflang link elements from the document head. */
  removeHreflangTags(): void {
    const hreflangLinks = this.doc.querySelectorAll('link[rel="alternate"][hreflang]');
    hreflangLinks.forEach((el) => el.remove());
  }

  /** Remove all dynamically-set meta tags and the canonical link. */
  clearMeta(): void {
    this.meta.removeTag('name="description"');

    // Open Graph
    this.meta.removeTag('property="og:title"');
    this.meta.removeTag('property="og:description"');
    this.meta.removeTag('property="og:image"');
    this.meta.removeTag('property="og:url"');
    this.meta.removeTag('property="og:type"');
    this.meta.removeTag('property="og:site_name"');

    // Twitter Card
    this.meta.removeTag('name="twitter:card"');
    this.meta.removeTag('name="twitter:title"');
    this.meta.removeTag('name="twitter:description"');
    this.meta.removeTag('name="twitter:image"');

    // Product price tags
    this.removeProductPriceTags();

    // Pagination links
    this.removePaginationLinks();

    // Hreflang links
    this.removeHreflangTags();

    // Canonical link
    const link = this.doc.querySelector('link[rel="canonical"]');
    if (link) {
      link.remove();
    }
  }
}
