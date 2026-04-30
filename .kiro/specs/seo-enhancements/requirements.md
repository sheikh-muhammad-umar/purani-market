# Requirements Document

## Introduction

This document defines the requirements for enhancing the SEO capabilities of the marketplace.pk Angular 21 + NestJS application. The application already has a solid SSR + SEO foundation implemented (SSR with `@angular/ssr`, canonical URLs, OG/Twitter tags, Product/BreadcrumbList/ItemList/WebSite JSON-LD structured data, sitemap.xml, robots.txt, prerendering, meta descriptions, Redis caching, SEO API endpoints, and route resolvers for listing/category/seller/home pages).

This spec addresses the remaining SEO gaps that prevent achieving optimal Google ranking. The enhancements are prioritized by Google ranking impact: product OG price tags, search page SEO, static page dedicated meta, pagination link relations, base HTML meta improvements, hreflang for Urdu/English, performance hints, geo meta tags, FAQ schema, and Organization schema.

## Glossary

- **Meta_Service**: The Angular service (`web/src/app/core/services/meta.service.ts`) responsible for dynamically setting HTML meta tags (title, description, Open Graph, Twitter Cards, canonical URL) per route
- **Structured_Data_Service**: The Angular service (`web/src/app/core/services/structured-data.service.ts`) that generates and injects JSON-LD schema.org markup into rendered pages
- **SEO_API**: The NestJS backend API endpoints (`backend/src/seo/seo.controller.ts`) that provide SEO metadata for frontend pages
- **SeoService**: The NestJS backend service (`backend/src/seo/seo.service.ts`) that queries MongoDB and builds SEO metadata DTOs
- **Search_Page**: The Angular search results page at `/search?q={query}` that currently has no SEO resolver, no meta tags, and no canonical handling
- **Static_Page**: One of the informational pages (about, terms, privacy, contact, careers, press, trust-safety, selling-tips, cookies) served under `/pages/{slug}`
- **Listing**: A product advertisement posted by a seller, containing title, description, price, images, location, and category
- **Category_Page**: A page displaying listings within a specific category, served at `/categories/{slug}`
- **Index_HTML**: The base `web/src/index.html` template that serves as the shell for all Angular pages
- **Hreflang_Tag**: An HTML link element (`<link rel="alternate" hreflang="...">`) that tells search engines which language version of a page to serve to users
- **Pagination_Link**: An HTML link element using `rel="next"` or `rel="prev"` that indicates the relationship between paginated pages in a series
- **Performance_Hint**: An HTML link element using `rel="dns-prefetch"` or `rel="preconnect"` that instructs the browser to resolve DNS or establish connections early
- **Geo_Meta_Tag**: An HTML meta tag (geo.region, geo.placename, geo.position) that provides geographic targeting signals to search engines
- **FAQ_Schema**: A schema.org FAQPage JSON-LD structured data type used to mark up frequently asked questions on help and static pages
- **Organization_Schema**: A schema.org Organization JSON-LD structured data type that provides business identity, contact information, and social profiles to search engines

## Requirements

### Requirement 1: Product OG Price Tags

**User Story:** As a user sharing a listing on social media or Google Shopping, I want the shared link to include price information in the Open Graph tags, so that price is visible in social previews and eligible for Google Shopping rich results.

#### Acceptance Criteria

1. WHEN a listing detail page is rendered, THE Meta_Service SHALL set the `og:price:amount` meta tag to the listing price amount
2. WHEN a listing detail page is rendered, THE Meta_Service SHALL set the `og:price:currency` meta tag to the listing price currency code (e.g., "PKR")
3. WHEN a listing detail page is rendered, THE Meta_Service SHALL set the `product:price:amount` meta tag to the listing price amount
4. WHEN a listing detail page is rendered, THE Meta_Service SHALL set the `product:price:currency` meta tag to the listing price currency code
5. IF a listing has no price defined, THEN THE Meta_Service SHALL omit the price-related OG tags rather than setting them to zero or empty values

### Requirement 2: Search Page SEO

**User Story:** As a marketplace operator, I want search result pages to have proper SEO metadata, so that search engines can index popular search queries and display accurate titles and descriptions.

#### Acceptance Criteria

1. WHEN a search results page is rendered with a query parameter, THE SEO_API SHALL provide a dedicated endpoint at `GET /api/seo/search` that accepts a `q` query parameter and returns search-specific SEO metadata including title, description, and canonical URL
2. WHEN a search results page is rendered, THE Meta_Service SHALL set the title to "Search: {query} | marketplace.pk" where {query} is the user search term
3. WHEN a search results page is rendered, THE Meta_Service SHALL set the description to "Find {query} listings on marketplace.pk. Browse results and discover the best deals in Pakistan."
4. WHEN a search results page is rendered, THE Meta_Service SHALL set the canonical URL to `https://marketplace.pk/search?q={query}` excluding pagination and filter parameters
5. WHEN a search results page is rendered without a query parameter, THE Meta_Service SHALL set the title to "Search Listings | marketplace.pk" and a generic search description
6. THE Search_Page route SHALL use a dedicated SEO resolver that fetches search SEO metadata from the SEO_API before the component renders
7. THE SEO_API SHALL cache search SEO responses using Redis with a TTL of 10 minutes

### Requirement 3: Static Pages Dedicated SEO

**User Story:** As a marketplace operator, I want each static page (about, terms, privacy, etc.) to have unique, page-specific meta tags, so that search engines display accurate titles and descriptions instead of generic fallback text.

#### Acceptance Criteria

1. THE SEO_API SHALL provide a dedicated endpoint at `GET /api/seo/page/:slug` that returns page-specific SEO metadata for each static page slug (about, terms, privacy, contact, careers, press, trust-safety, selling-tips, cookies)
2. WHEN a static page is rendered, THE Meta_Service SHALL set a unique title specific to that page (e.g., "About Us | marketplace.pk", "Terms of Service | marketplace.pk", "Privacy Policy | marketplace.pk")
3. WHEN a static page is rendered, THE Meta_Service SHALL set a unique description specific to that page content
4. WHEN a static page is rendered, THE Meta_Service SHALL set the canonical URL to `https://marketplace.pk/pages/{slug}`
5. WHEN a static page is rendered, THE Meta_Service SHALL set Open Graph tags with og:type "website", the page-specific title, description, and canonical URL
6. THE Static_Page routes SHALL use a dedicated SEO resolver that fetches page-specific SEO metadata from the SEO_API before the component renders
7. IF an unrecognized page slug is requested from the SEO_API, THEN THE SEO_API SHALL return a 404 status code
8. THE SEO_API SHALL cache static page SEO responses using Redis with a TTL of 24 hours

### Requirement 4: Pagination Link Relations

**User Story:** As a marketplace operator, I want paginated category and search result pages to include rel="next" and rel="prev" link elements, so that search engines understand the relationship between pages in a paginated series.

#### Acceptance Criteria

1. WHEN a paginated page has a next page, THE Meta_Service SHALL inject a `<link rel="next" href="{next_page_url}">` element in the document head
2. WHEN a paginated page has a previous page, THE Meta_Service SHALL inject a `<link rel="prev" href="{prev_page_url}">` element in the document head
3. WHEN the first page of a paginated series is rendered, THE Meta_Service SHALL inject only a `rel="next"` link and omit the `rel="prev"` link
4. WHEN the last page of a paginated series is rendered, THE Meta_Service SHALL inject only a `rel="prev"` link and omit the `rel="next"` link
5. THE Meta_Service SHALL construct pagination URLs using the canonical base URL with a `page` query parameter (e.g., `https://marketplace.pk/categories/{slug}?page=2`)
6. WHEN navigating between pages, THE Meta_Service SHALL remove stale pagination link elements before setting new ones

### Requirement 5: Index HTML Base Meta Improvements

**User Story:** As a marketplace operator, I want the base HTML template to include default robots directives and default Open Graph tags, so that every page has baseline SEO signals even before Angular hydrates.

#### Acceptance Criteria

1. THE Index_HTML SHALL include a `<meta name="robots" content="index, follow">` tag as the default robots directive
2. THE Index_HTML SHALL include a default `<meta property="og:site_name" content="marketplace.pk">` tag
3. THE Index_HTML SHALL include a default `<meta property="og:type" content="website">` tag
4. THE Index_HTML SHALL include a default `<meta property="og:image" content="https://marketplace.pk/assets/og-default.png">` tag referencing a dedicated default OG image
5. THE Index_HTML SHALL include a default `<meta name="theme-color" content="{brand_color}">` tag for mobile browser chrome theming
6. THE Index_HTML SHALL include a `<meta name="format-detection" content="telephone=no">` tag to prevent automatic phone number detection on mobile

### Requirement 6: Hreflang for Urdu and English

**User Story:** As a marketplace operator serving a Pakistani audience with Urdu and English content, I want hreflang tags on all public pages, so that Google serves the correct language version to users based on their language preference.

#### Acceptance Criteria

1. WHEN any public page is rendered, THE Meta_Service SHALL inject a `<link rel="alternate" hreflang="en" href="{canonical_url}">` element in the document head
2. WHEN any public page is rendered, THE Meta_Service SHALL inject a `<link rel="alternate" hreflang="ur" href="{canonical_url}">` element in the document head
3. WHEN any public page is rendered, THE Meta_Service SHALL inject a `<link rel="alternate" hreflang="x-default" href="{canonical_url}">` element in the document head pointing to the English version as the default
4. THE Meta_Service SHALL set the `<html lang="en">` attribute on the document root element
5. WHEN navigating between pages, THE Meta_Service SHALL update the hreflang link elements to reflect the current page canonical URL

### Requirement 7: Performance Hints

**User Story:** As a marketplace operator, I want the HTML to include DNS prefetch and preconnect hints for external domains, so that browsers resolve DNS and establish connections early, improving page load performance and Core Web Vitals scores.

#### Acceptance Criteria

1. THE Index_HTML SHALL include `<link rel="dns-prefetch" href="{api_domain}">` for the backend API domain
2. THE Index_HTML SHALL include `<link rel="dns-prefetch" href="{cdn_domain}">` for the CDN domain serving images and static assets
3. THE Index_HTML SHALL include `<link rel="preconnect" href="{api_domain}">` for the backend API domain
4. THE Index_HTML SHALL include `<link rel="preconnect" href="{cdn_domain}" crossorigin>` for the CDN domain with crossorigin attribute
5. THE Index_HTML SHALL include `<link rel="preconnect" href="https://fonts.googleapis.com">` for Google Fonts
6. THE Index_HTML SHALL include `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` for Google Fonts static assets

### Requirement 8: Geo Meta Tags

**User Story:** As a marketplace operator targeting Pakistani users, I want geo-targeting meta tags on all pages, so that search engines understand the geographic focus of the marketplace and prioritize it for Pakistan-based searches.

#### Acceptance Criteria

1. THE Index_HTML SHALL include a `<meta name="geo.region" content="PK">` tag indicating Pakistan as the target region
2. THE Index_HTML SHALL include a `<meta name="geo.placename" content="Pakistan">` tag indicating the target location name
3. THE Index_HTML SHALL include a `<meta name="geo.position" content="30.3753;69.3451">` tag with Pakistan centroid coordinates
4. THE Index_HTML SHALL include a `<meta name="ICBM" content="30.3753, 69.3451">` tag as an alternative geo-targeting format

### Requirement 9: FAQ Schema for Static Pages

**User Story:** As a marketplace operator, I want FAQ structured data on help and informational pages, so that Google can display FAQ rich snippets in search results, increasing click-through rates.

#### Acceptance Criteria

1. WHEN a static page contains FAQ content, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "FAQPage" type containing an array of "Question" and "Answer" pairs
2. THE SEO_API static page endpoint SHALL return an optional `faqJsonLd` field containing pre-built FAQ structured data when FAQ content exists for that page
3. WHEN the SEO_API returns FAQ data for a static page, THE Structured_Data_Service SHALL inject the FAQ JSON-LD alongside the existing page structured data
4. THE FAQ JSON-LD SHALL contain a `@context` field set to "https://schema.org", a `@type` field set to "FAQPage", and a `mainEntity` array of Question objects each with `name` (question text) and `acceptedAnswer` containing `text` (answer text)
5. IF a static page has no FAQ content, THEN THE Structured_Data_Service SHALL omit the FAQ JSON-LD for that page

### Requirement 10: Organization Schema

**User Story:** As a marketplace operator, I want Organization structured data on the home page, so that Google displays a knowledge panel with the marketplace brand, logo, contact information, and social profiles.

#### Acceptance Criteria

1. WHEN the home page is rendered, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "Organization" type
2. THE Organization JSON-LD SHALL include the organization name ("marketplace.pk"), URL, logo URL, and a description of the marketplace
3. THE Organization JSON-LD SHALL include a `contactPoint` with type "CustomerService", telephone number, contact type, and available language (English, Urdu)
4. THE Organization JSON-LD SHALL include a `sameAs` array listing the marketplace social media profile URLs (Facebook, Twitter, Instagram)
5. THE Organization JSON-LD SHALL include an `address` with type "PostalAddress" containing the country "Pakistan"
6. THE SEO_API home endpoint SHALL return an additional `organizationJsonLd` field containing the pre-built Organization structured data
