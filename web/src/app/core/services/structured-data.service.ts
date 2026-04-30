import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BreadcrumbItem } from '../models/seo.models';

/** Data attribute used to identify JSON-LD script tags injected by this service. */
const JSONLD_ATTR = 'data-seo-jsonld';

/** Type alias for JSON-LD structured data objects. */
type JsonLdData = Record<string, unknown>;

/**
 * Injects and removes JSON-LD `<script type="application/ld+json">` tags
 * in the document `<head>`. Each setter replaces any existing tag of the
 * same type so there is at most one per schema type at any time.
 */
@Injectable({ providedIn: 'root' })
export class StructuredDataService {
  private readonly doc = inject(DOCUMENT);

  /** Inject Product JSON-LD (pre-built by the backend). */
  setProductData(data: JsonLdData): void {
    this.setJsonLd('product', data);
  }

  /** Inject ItemList JSON-LD for category pages. */
  setCategoryData(data: JsonLdData): void {
    this.setJsonLd('category', data);
  }

  /** Inject Person / Organization JSON-LD for seller pages. */
  setSellerData(data: JsonLdData): void {
    this.setJsonLd('seller', data);
  }

  /** Inject WebSite JSON-LD (with SearchAction) for the home page. */
  setWebsiteData(data: JsonLdData): void {
    this.setJsonLd('website', data);
  }

  /** Inject FAQPage JSON-LD. */
  setFaqData(data: JsonLdData): void {
    this.setJsonLd('faq', data);
  }

  /** Inject Organization JSON-LD. */
  setOrganizationData(data: JsonLdData): void {
    this.setJsonLd('organization', data);
  }

  /** Inject BreadcrumbList JSON-LD from an array of breadcrumb items. */
  setBreadcrumbData(breadcrumbs: BreadcrumbItem[]): void {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item) => ({
        '@type': 'ListItem',
        position: item.position,
        name: item.name,
        item: item.url,
      })),
    };
    this.setJsonLd('breadcrumb', jsonLd);
  }

  /** Remove all JSON-LD script tags injected by this service. */
  clearStructuredData(): void {
    const scripts = this.doc.querySelectorAll(`script[${JSONLD_ATTR}]`);
    scripts.forEach((el) => el.remove());
  }

  // ── private helpers ──

  /**
   * Insert (or replace) a JSON-LD script tag identified by `key`.
   * Using a key ensures we never duplicate the same schema type.
   */
  private setJsonLd(key: string, data: JsonLdData): void {
    const attrSelector = `script[${JSONLD_ATTR}="${key}"]`;
    let script: HTMLScriptElement | null = this.doc.querySelector(attrSelector);

    if (!script) {
      script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute(JSONLD_ATTR, key);
      this.doc.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }
}
