import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { StructuredDataService } from './structured-data.service';

// ─────────────────────────────────────────────────────────────────────────────
// Task 9.7 — Unit tests for StructuredDataService
// ─────────────────────────────────────────────────────────────────────────────

describe('StructuredDataService — Unit Tests', () => {
  let service: StructuredDataService;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StructuredDataService],
    });
    service = TestBed.inject(StructuredDataService);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    service.clearStructuredData();
  });

  describe('JSON-LD script tag injection', () => {
    it('should inject a JSON-LD script tag into the document head', () => {
      const productData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'iPhone 15 Pro',
        description: 'Brand new iPhone',
      };

      service.setProductData(productData);

      const script = doc.querySelector('script[data-seo-jsonld="product"]');
      expect(script).not.toBeNull();
      expect(script!.getAttribute('type')).toBe('application/ld+json');

      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('Product');
      expect(parsed.name).toBe('iPhone 15 Pro');
    });

    it('should replace existing script tag of the same type on subsequent calls', () => {
      service.setProductData({ '@type': 'Product', name: 'First' });
      service.setProductData({ '@type': 'Product', name: 'Second' });

      const scripts = doc.querySelectorAll('script[data-seo-jsonld="product"]');
      expect(scripts.length).toBe(1);

      const parsed = JSON.parse(scripts[0].textContent!);
      expect(parsed.name).toBe('Second');
    });

    it('should allow multiple different schema types simultaneously', () => {
      service.setProductData({ '@type': 'Product', name: 'Phone' });
      service.setCategoryData({ '@type': 'ItemList', name: 'Electronics' });
      service.setWebsiteData({ '@type': 'WebSite', name: 'marketplace.pk' });

      const productScript = doc.querySelector('script[data-seo-jsonld="product"]');
      const categoryScript = doc.querySelector('script[data-seo-jsonld="category"]');
      const websiteScript = doc.querySelector('script[data-seo-jsonld="website"]');

      expect(productScript).not.toBeNull();
      expect(categoryScript).not.toBeNull();
      expect(websiteScript).not.toBeNull();
    });
  });

  describe('clearStructuredData', () => {
    it('should remove all injected JSON-LD script tags', () => {
      service.setProductData({ '@type': 'Product', name: 'Phone' });
      service.setCategoryData({ '@type': 'ItemList', name: 'Electronics' });
      service.setSellerData({ '@type': 'Person', name: 'John' });
      service.setWebsiteData({ '@type': 'WebSite', name: 'marketplace.pk' });

      // Verify they exist
      expect(doc.querySelectorAll('script[data-seo-jsonld]').length).toBe(4);

      service.clearStructuredData();

      expect(doc.querySelectorAll('script[data-seo-jsonld]').length).toBe(0);
    });

    it('should not affect other script tags in the document', () => {
      // Add a non-JSON-LD script tag
      const otherScript = doc.createElement('script');
      otherScript.setAttribute('type', 'text/javascript');
      otherScript.textContent = 'console.log("test")';
      doc.head.appendChild(otherScript);

      service.setProductData({ '@type': 'Product', name: 'Phone' });
      service.clearStructuredData();

      // The non-JSON-LD script should still be there
      const remaining = doc.querySelectorAll('script[type="text/javascript"]');
      expect(remaining.length).toBeGreaterThanOrEqual(1);

      // Clean up
      otherScript.remove();
    });
  });

  describe('entity type correctness', () => {
    it('should produce correct @type "Product" for setProductData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Samsung Galaxy S24',
        offers: { price: 250000, priceCurrency: 'PKR' },
      };

      service.setProductData(data);

      const script = doc.querySelector('script[data-seo-jsonld="product"]');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('Product');
    });

    it('should produce correct @type "ItemList" for setCategoryData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Mobile Phones',
        numberOfItems: 150,
      };

      service.setCategoryData(data);

      const script = doc.querySelector('script[data-seo-jsonld="category"]');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('ItemList');
    });

    it('should produce correct @type "Person" for setSellerData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Ali Khan',
        address: { addressLocality: 'Lahore' },
      };

      service.setSellerData(data);

      const script = doc.querySelector('script[data-seo-jsonld="seller"]');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('Person');
    });

    it('should produce correct @type "WebSite" for setWebsiteData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'marketplace.pk',
        url: 'https://marketplace.pk',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://marketplace.pk/search?q={search_term_string}',
        },
      };

      service.setWebsiteData(data);

      const script = doc.querySelector('script[data-seo-jsonld="website"]');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('WebSite');
      expect(parsed.potentialAction['@type']).toBe('SearchAction');
    });

    it('should produce correct @type "FAQPage" for setFaqData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How do I create an account?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Visit the registration page and sign up.',
            },
          },
        ],
      };

      service.setFaqData(data);

      const script = doc.querySelector('script[data-seo-jsonld="faq"]');
      expect(script).not.toBeNull();
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('FAQPage');
      expect(parsed.mainEntity).toHaveLength(1);
      expect(parsed.mainEntity[0]['@type']).toBe('Question');
      expect(parsed.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
    });

    it('should produce correct @type "Organization" for setOrganizationData', () => {
      const data = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'marketplace.pk',
        url: 'https://marketplace.pk',
        logo: 'https://marketplace.pk/assets/logo.png',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Service',
          availableLanguage: ['English', 'Urdu'],
        },
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'PK',
        },
      };

      service.setOrganizationData(data);

      const script = doc.querySelector('script[data-seo-jsonld="organization"]');
      expect(script).not.toBeNull();
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('Organization');
      expect(parsed.name).toBe('marketplace.pk');
      expect(parsed.contactPoint['@type']).toBe('ContactPoint');
      expect(parsed.address.addressCountry).toBe('PK');
    });

    it('should produce correct @type "BreadcrumbList" for setBreadcrumbData', () => {
      service.setBreadcrumbData([
        { name: 'Home', url: 'https://marketplace.pk', position: 1 },
        { name: 'Electronics', url: 'https://marketplace.pk/categories/electronics', position: 2 },
        {
          name: 'Mobile Phones',
          url: 'https://marketplace.pk/categories/mobile-phones',
          position: 3,
        },
      ]);

      const script = doc.querySelector('script[data-seo-jsonld="breadcrumb"]');
      const parsed = JSON.parse(script!.textContent!);
      expect(parsed['@type']).toBe('BreadcrumbList');
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed.itemListElement).toHaveLength(3);
      expect(parsed.itemListElement[0].position).toBe(1);
      expect(parsed.itemListElement[0].name).toBe('Home');
      expect(parsed.itemListElement[2].position).toBe(3);
    });
  });
});
