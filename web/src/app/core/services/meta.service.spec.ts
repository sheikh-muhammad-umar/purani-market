import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { MetaService } from './meta.service';
import * as fc from 'fast-check';

const PLACEHOLDER_IMAGE = 'https://marketplace.pk/assets/placeholder.png';

/**
 * Creates a minimal mock document for testing MetaService.
 * Simulates the <head> element with meta tag and link element management.
 */
function createMockDocument() {
  const metaTags = new Map<string, HTMLMetaElement>();
  const linkElements: HTMLLinkElement[] = [];

  const head = {
    appendChild: (el: any) => {
      if (el.tagName === 'LINK') {
        linkElements.push(el);
      }
    },
  };

  const doc = {
    head,
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        attributes: {} as Record<string, string>,
        setAttribute(key: string, value: string) {
          this.attributes[key] = value;
        },
        getAttribute(key: string) {
          return this.attributes[key] ?? null;
        },
        remove() {
          const idx = linkElements.indexOf(el);
          if (idx >= 0) linkElements.splice(idx, 1);
        },
      };
      return el;
    },
    querySelector: (selector: string) => {
      // Handle link[rel="canonical"]
      if (selector === 'link[rel="canonical"]') {
        return linkElements.find((l) => l.getAttribute('rel') === 'canonical') ?? null;
      }
      return null;
    },
  };

  return { doc, metaTags, linkElements };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 9.5 — Property test: Social sharing tags completeness
// Feature: seo-ssr-implementation, Property 3: Social sharing tags completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('MetaService — Property 3: Social sharing tags completeness', () => {
  let service: MetaService;
  let metaService: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MetaService],
    });
    service = TestBed.inject(MetaService);
    metaService = TestBed.inject(Meta);
  });

  afterEach(() => {
    service.clearMeta();
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
   *
   * For any page data, all required OG tags must be present after calling
   * setOpenGraphTags, and og:image / twitter:image must never be empty
   * (placeholder used when no image is provided).
   */
  it('should always set all required OG tags for arbitrary page data', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 300 }),
          image: fc.oneof(fc.constant(''), fc.webUrl()),
          url: fc.webUrl(),
          type: fc.constantFrom('website', 'product', 'profile'),
          siteName: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (config) => {
          service.setOpenGraphTags(config);

          const ogTitle = metaService.getTag('property="og:title"');
          const ogDescription = metaService.getTag('property="og:description"');
          const ogImage = metaService.getTag('property="og:image"');
          const ogUrl = metaService.getTag('property="og:url"');
          const ogType = metaService.getTag('property="og:type"');
          const ogSiteName = metaService.getTag('property="og:site_name"');

          // All required OG tags must be present
          expect(ogTitle).not.toBeNull();
          expect(ogDescription).not.toBeNull();
          expect(ogImage).not.toBeNull();
          expect(ogUrl).not.toBeNull();
          expect(ogType).not.toBeNull();
          expect(ogSiteName).not.toBeNull();

          // og:image must never be empty — placeholder used when no image
          expect(ogImage!.content).toBeTruthy();
          if (config.image === '') {
            expect(ogImage!.content).toBe(PLACEHOLDER_IMAGE);
          } else {
            expect(ogImage!.content).toBe(config.image);
          }

          // Clean up for next iteration
          service.clearMeta();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should always set all required Twitter Card tags and twitter:image is never empty', () => {
    fc.assert(
      fc.property(
        fc.record({
          card: fc.constantFrom('summary', 'summary_large_image'),
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 300 }),
          image: fc.oneof(fc.constant(''), fc.webUrl()),
        }),
        (config) => {
          service.setTwitterCardTags(config);

          const twitterCard = metaService.getTag('name="twitter:card"');
          const twitterTitle = metaService.getTag('name="twitter:title"');
          const twitterDescription = metaService.getTag('name="twitter:description"');
          const twitterImage = metaService.getTag('name="twitter:image"');

          // All required Twitter Card tags must be present
          expect(twitterCard).not.toBeNull();
          expect(twitterTitle).not.toBeNull();
          expect(twitterDescription).not.toBeNull();
          expect(twitterImage).not.toBeNull();

          // twitter:image must never be empty — placeholder used when no image
          expect(twitterImage!.content).toBeTruthy();
          if (config.image === '') {
            expect(twitterImage!.content).toBe(PLACEHOLDER_IMAGE);
          } else {
            expect(twitterImage!.content).toBe(config.image);
          }

          // Clean up for next iteration
          service.clearMeta();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should set all OG + Twitter tags via setPageMeta with placeholder when no image', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 300 }),
          imageUrl: fc.option(fc.webUrl(), { nil: undefined }),
          canonicalUrl: fc.webUrl(),
          ogType: fc.constantFrom('website' as const, 'product' as const, 'profile' as const),
          twitterCard: fc.constantFrom('summary' as const, 'summary_large_image' as const),
        }),
        (config) => {
          service.setPageMeta(config);

          // OG tags
          const ogTitle = metaService.getTag('property="og:title"');
          const ogDescription = metaService.getTag('property="og:description"');
          const ogImage = metaService.getTag('property="og:image"');
          const ogUrl = metaService.getTag('property="og:url"');
          const ogType = metaService.getTag('property="og:type"');
          const ogSiteName = metaService.getTag('property="og:site_name"');

          expect(ogTitle).not.toBeNull();
          expect(ogDescription).not.toBeNull();
          expect(ogImage).not.toBeNull();
          expect(ogUrl).not.toBeNull();
          expect(ogType).not.toBeNull();
          expect(ogSiteName).not.toBeNull();

          // Image is never empty
          expect(ogImage!.content).toBeTruthy();
          if (!config.imageUrl) {
            expect(ogImage!.content).toBe(PLACEHOLDER_IMAGE);
          }

          // Twitter tags
          const twitterImage = metaService.getTag('name="twitter:image"');
          expect(twitterImage).not.toBeNull();
          expect(twitterImage!.content).toBeTruthy();
          if (!config.imageUrl) {
            expect(twitterImage!.content).toBe(PLACEHOLDER_IMAGE);
          }

          // Clean up for next iteration
          service.clearMeta();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 9.6 — Unit tests for MetaService
// ─────────────────────────────────────────────────────────────────────────────

describe('MetaService — Unit Tests', () => {
  let service: MetaService;
  let metaService: Meta;
  let titleService: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MetaService],
    });
    service = TestBed.inject(MetaService);
    metaService = TestBed.inject(Meta);
    titleService = TestBed.inject(Title);
  });

  afterEach(() => {
    service.clearMeta();
  });

  describe('setPageMeta', () => {
    it('should set the page title correctly', () => {
      service.setPageMeta({
        title: 'iPhone 15 Pro - PKR 350000 | marketplace.pk',
        description: 'Brand new iPhone 15 Pro for sale.',
        canonicalUrl: 'https://marketplace.pk/listings/iphone-15-pro-abc123',
      });

      expect(titleService.getTitle()).toBe('iPhone 15 Pro - PKR 350000 | marketplace.pk');
    });

    it('should set the description meta tag', () => {
      service.setPageMeta({
        title: 'Test Page',
        description: 'This is a test description for the page.',
        canonicalUrl: 'https://marketplace.pk/test',
      });

      const descTag = metaService.getTag('name="description"');
      expect(descTag).not.toBeNull();
      expect(descTag!.content).toBe('This is a test description for the page.');
    });

    it('should use placeholder image when imageUrl is not provided', () => {
      service.setPageMeta({
        title: 'No Image Page',
        description: 'Page without image.',
        canonicalUrl: 'https://marketplace.pk/no-image',
      });

      const ogImage = metaService.getTag('property="og:image"');
      expect(ogImage!.content).toBe(PLACEHOLDER_IMAGE);

      const twitterImage = metaService.getTag('name="twitter:image"');
      expect(twitterImage!.content).toBe(PLACEHOLDER_IMAGE);
    });

    it('should use provided imageUrl when available', () => {
      service.setPageMeta({
        title: 'With Image',
        description: 'Page with image.',
        canonicalUrl: 'https://marketplace.pk/with-image',
        imageUrl: 'https://cdn.marketplace.pk/img/product.jpg',
      });

      const ogImage = metaService.getTag('property="og:image"');
      expect(ogImage!.content).toBe('https://cdn.marketplace.pk/img/product.jpg');
    });
  });

  describe('setOpenGraphTags', () => {
    it('should set all required OG meta tags', () => {
      service.setOpenGraphTags({
        title: 'OG Title',
        description: 'OG Description',
        image: 'https://example.com/image.jpg',
        url: 'https://marketplace.pk/page',
        type: 'product',
        siteName: 'marketplace.pk',
      });

      expect(metaService.getTag('property="og:title"')!.content).toBe('OG Title');
      expect(metaService.getTag('property="og:description"')!.content).toBe('OG Description');
      expect(metaService.getTag('property="og:image"')!.content).toBe(
        'https://example.com/image.jpg',
      );
      expect(metaService.getTag('property="og:url"')!.content).toBe('https://marketplace.pk/page');
      expect(metaService.getTag('property="og:type"')!.content).toBe('product');
      expect(metaService.getTag('property="og:site_name"')!.content).toBe('marketplace.pk');
    });

    it('should use placeholder image when image is empty string', () => {
      service.setOpenGraphTags({
        title: 'Title',
        description: 'Desc',
        image: '',
        url: 'https://marketplace.pk',
        type: 'website',
        siteName: 'marketplace.pk',
      });

      expect(metaService.getTag('property="og:image"')!.content).toBe(PLACEHOLDER_IMAGE);
    });
  });

  describe('setCanonicalUrl', () => {
    it('should create a canonical link element when none exists', () => {
      const doc = TestBed.inject(DOCUMENT);
      // Ensure no canonical link exists initially
      const existing = doc.querySelector('link[rel="canonical"]');
      if (existing) existing.remove();

      service.setCanonicalUrl('https://marketplace.pk/listings/test-123');

      const link = doc.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('https://marketplace.pk/listings/test-123');
    });

    it('should update existing canonical link element', () => {
      service.setCanonicalUrl('https://marketplace.pk/first');
      service.setCanonicalUrl('https://marketplace.pk/second');

      const doc = TestBed.inject(DOCUMENT);
      const links = doc.querySelectorAll('link[rel="canonical"]');
      expect(links.length).toBe(1);
      expect((links[0] as HTMLLinkElement).getAttribute('href')).toBe(
        'https://marketplace.pk/second',
      );
    });
  });

  describe('clearMeta', () => {
    it('should remove all dynamically set meta tags', () => {
      service.setPageMeta({
        title: 'To Be Cleared',
        description: 'Will be removed.',
        canonicalUrl: 'https://marketplace.pk/clear-test',
        imageUrl: 'https://example.com/img.jpg',
      });

      service.clearMeta();

      expect(metaService.getTag('name="description"')).toBeNull();
      expect(metaService.getTag('property="og:title"')).toBeNull();
      expect(metaService.getTag('property="og:description"')).toBeNull();
      expect(metaService.getTag('property="og:image"')).toBeNull();
      expect(metaService.getTag('property="og:url"')).toBeNull();
      expect(metaService.getTag('property="og:type"')).toBeNull();
      expect(metaService.getTag('property="og:site_name"')).toBeNull();
      expect(metaService.getTag('name="twitter:card"')).toBeNull();
      expect(metaService.getTag('name="twitter:title"')).toBeNull();
      expect(metaService.getTag('name="twitter:description"')).toBeNull();
      expect(metaService.getTag('name="twitter:image"')).toBeNull();
    });

    it('should remove the canonical link element', () => {
      service.setCanonicalUrl('https://marketplace.pk/to-remove');
      service.clearMeta();

      const doc = TestBed.inject(DOCUMENT);
      const link = doc.querySelector('link[rel="canonical"]');
      expect(link).toBeNull();
    });
  });

  describe('setProductPriceTags', () => {
    it('should set all four price meta tags when amount is valid', () => {
      service.setProductPriceTags(35000, 'PKR');

      expect(metaService.getTag('property="og:price:amount"')!.content).toBe('35000');
      expect(metaService.getTag('property="og:price:currency"')!.content).toBe('PKR');
      expect(metaService.getTag('property="product:price:amount"')!.content).toBe('35000');
      expect(metaService.getTag('property="product:price:currency"')!.content).toBe('PKR');
    });

    it('should not set tags when amount is undefined', () => {
      service.setProductPriceTags(undefined, 'PKR');

      expect(metaService.getTag('property="og:price:amount"')).toBeNull();
      expect(metaService.getTag('property="og:price:currency"')).toBeNull();
      expect(metaService.getTag('property="product:price:amount"')).toBeNull();
      expect(metaService.getTag('property="product:price:currency"')).toBeNull();
    });

    it('should not set tags when amount is null', () => {
      service.setProductPriceTags(null, 'PKR');

      expect(metaService.getTag('property="og:price:amount"')).toBeNull();
    });

    it('should not set tags when amount is 0', () => {
      service.setProductPriceTags(0, 'PKR');

      expect(metaService.getTag('property="og:price:amount"')).toBeNull();
    });
  });

  describe('removeProductPriceTags', () => {
    it('should remove all four price meta tags', () => {
      service.setProductPriceTags(50000, 'PKR');
      service.removeProductPriceTags();

      expect(metaService.getTag('property="og:price:amount"')).toBeNull();
      expect(metaService.getTag('property="og:price:currency"')).toBeNull();
      expect(metaService.getTag('property="product:price:amount"')).toBeNull();
      expect(metaService.getTag('property="product:price:currency"')).toBeNull();
    });

    it('should not throw when no price tags exist', () => {
      expect(() => service.removeProductPriceTags()).not.toThrow();
    });
  });

  describe('setPaginationLinks', () => {
    it('should inject rel="next" link when nextUrl is provided', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({ nextUrl: 'https://marketplace.pk/categories/cars?page=2' });

      const nextLink = doc.querySelector('link[rel="next"]') as HTMLLinkElement;
      expect(nextLink).not.toBeNull();
      expect(nextLink.getAttribute('href')).toBe('https://marketplace.pk/categories/cars?page=2');
    });

    it('should inject rel="prev" link when prevUrl is provided', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({ prevUrl: 'https://marketplace.pk/categories/cars?page=1' });

      const prevLink = doc.querySelector('link[rel="prev"]') as HTMLLinkElement;
      expect(prevLink).not.toBeNull();
      expect(prevLink.getAttribute('href')).toBe('https://marketplace.pk/categories/cars?page=1');
    });

    it('should inject both next and prev links when both URLs are provided', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({
        nextUrl: 'https://marketplace.pk/categories/cars?page=3',
        prevUrl: 'https://marketplace.pk/categories/cars?page=1',
      });

      const nextLink = doc.querySelector('link[rel="next"]') as HTMLLinkElement;
      const prevLink = doc.querySelector('link[rel="prev"]') as HTMLLinkElement;
      expect(nextLink).not.toBeNull();
      expect(prevLink).not.toBeNull();
      expect(nextLink.getAttribute('href')).toBe('https://marketplace.pk/categories/cars?page=3');
      expect(prevLink.getAttribute('href')).toBe('https://marketplace.pk/categories/cars?page=1');
    });

    it('should not inject any links when config has no URLs', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({});

      expect(doc.querySelector('link[rel="next"]')).toBeNull();
      expect(doc.querySelector('link[rel="prev"]')).toBeNull();
    });

    it('should remove stale pagination links before setting new ones', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({
        nextUrl: 'https://marketplace.pk/categories/cars?page=2',
        prevUrl: 'https://marketplace.pk/categories/cars?page=0',
      });

      // Set new pagination links — stale ones should be removed first
      service.setPaginationLinks({
        nextUrl: 'https://marketplace.pk/categories/cars?page=4',
      });

      const nextLinks = doc.querySelectorAll('link[rel="next"]');
      const prevLinks = doc.querySelectorAll('link[rel="prev"]');
      expect(nextLinks.length).toBe(1);
      expect(prevLinks.length).toBe(0);
      expect((nextLinks[0] as HTMLLinkElement).getAttribute('href')).toBe(
        'https://marketplace.pk/categories/cars?page=4',
      );
    });
  });

  describe('removePaginationLinks', () => {
    it('should remove all rel="next" and rel="prev" link elements', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({
        nextUrl: 'https://marketplace.pk/categories/cars?page=2',
        prevUrl: 'https://marketplace.pk/categories/cars?page=0',
      });

      service.removePaginationLinks();

      expect(doc.querySelector('link[rel="next"]')).toBeNull();
      expect(doc.querySelector('link[rel="prev"]')).toBeNull();
    });

    it('should not throw when no pagination links exist', () => {
      expect(() => service.removePaginationLinks()).not.toThrow();
    });
  });

  describe('clearMeta — pagination links', () => {
    it('should remove pagination links when clearMeta is called', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setPaginationLinks({
        nextUrl: 'https://marketplace.pk/categories/cars?page=2',
        prevUrl: 'https://marketplace.pk/categories/cars?page=1',
      });

      service.clearMeta();

      expect(doc.querySelector('link[rel="next"]')).toBeNull();
      expect(doc.querySelector('link[rel="prev"]')).toBeNull();
    });
  });

  describe('setHreflangTags', () => {
    it('should inject three hreflang link elements with correct attributes', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setHreflangTags('https://marketplace.pk/listings/test-123');

      const enLink = doc.querySelector('link[rel="alternate"][hreflang="en"]') as HTMLLinkElement;
      const urLink = doc.querySelector('link[rel="alternate"][hreflang="ur"]') as HTMLLinkElement;
      const defaultLink = doc.querySelector(
        'link[rel="alternate"][hreflang="x-default"]',
      ) as HTMLLinkElement;

      expect(enLink).not.toBeNull();
      expect(urLink).not.toBeNull();
      expect(defaultLink).not.toBeNull();

      expect(enLink.getAttribute('href')).toBe('https://marketplace.pk/listings/test-123');
      expect(urLink.getAttribute('href')).toBe('https://marketplace.pk/listings/test-123');
      expect(defaultLink.getAttribute('href')).toBe('https://marketplace.pk/listings/test-123');
    });

    it('should update existing hreflang links without creating duplicates', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setHreflangTags('https://marketplace.pk/first');
      service.setHreflangTags('https://marketplace.pk/second');

      const allHreflangLinks = doc.querySelectorAll('link[rel="alternate"][hreflang]');
      expect(allHreflangLinks.length).toBe(3);

      const enLink = doc.querySelector('link[rel="alternate"][hreflang="en"]') as HTMLLinkElement;
      expect(enLink.getAttribute('href')).toBe('https://marketplace.pk/second');

      const urLink = doc.querySelector('link[rel="alternate"][hreflang="ur"]') as HTMLLinkElement;
      expect(urLink.getAttribute('href')).toBe('https://marketplace.pk/second');

      const defaultLink = doc.querySelector(
        'link[rel="alternate"][hreflang="x-default"]',
      ) as HTMLLinkElement;
      expect(defaultLink.getAttribute('href')).toBe('https://marketplace.pk/second');
    });
  });

  describe('removeHreflangTags', () => {
    it('should remove all hreflang link elements', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setHreflangTags('https://marketplace.pk/test');
      service.removeHreflangTags();

      expect(doc.querySelector('link[rel="alternate"][hreflang]')).toBeNull();
    });

    it('should not throw when no hreflang links exist', () => {
      expect(() => service.removeHreflangTags()).not.toThrow();
    });
  });

  describe('clearMeta — hreflang links', () => {
    it('should remove hreflang links when clearMeta is called', () => {
      const doc = TestBed.inject(DOCUMENT);
      service.setHreflangTags('https://marketplace.pk/test');

      service.clearMeta();

      expect(doc.querySelector('link[rel="alternate"][hreflang]')).toBeNull();
    });
  });

  describe('setFallbackMeta', () => {
    it('should set generic marketplace title and description', () => {
      service.setFallbackMeta();

      expect(titleService.getTitle()).toBe('marketplace.pk');

      const descTag = metaService.getTag('name="description"');
      expect(descTag).not.toBeNull();
      expect(descTag!.content).toBe(
        'Buy and sell new & used products in Pakistan. Find the best deals on marketplace.pk.',
      );
    });

    it('should set OG tags with placeholder image', () => {
      service.setFallbackMeta();

      expect(metaService.getTag('property="og:title"')!.content).toBe('marketplace.pk');
      expect(metaService.getTag('property="og:image"')!.content).toBe(PLACEHOLDER_IMAGE);
      expect(metaService.getTag('property="og:type"')!.content).toBe('website');
      expect(metaService.getTag('property="og:site_name"')!.content).toBe('marketplace.pk');
    });

    it('should set Twitter Card tags with placeholder image', () => {
      service.setFallbackMeta();

      expect(metaService.getTag('name="twitter:card"')!.content).toBe('summary');
      expect(metaService.getTag('name="twitter:image"')!.content).toBe(PLACEHOLDER_IMAGE);
    });
  });
});
