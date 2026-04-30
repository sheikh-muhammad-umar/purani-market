# Requirements Document

## Introduction

This document defines the requirements for implementing Server-Side Rendering (SSR) and Search Engine Optimization (SEO) for the marketplace.pk Angular + NestJS application. The marketplace is currently a pure client-side rendered Single Page Application (SPA), which prevents search engines from properly indexing listing content, category pages, and seller profiles. Implementing SSR with Angular Universal and comprehensive SEO metadata will enable Google and other search engines to crawl and index all public marketplace content, improving organic traffic and social media sharing previews.

## Glossary

- **SSR_Engine**: The Angular Universal server-side rendering engine that renders Angular components on the server before sending HTML to the browser
- **Meta_Service**: The Angular service responsible for dynamically setting HTML meta tags (title, description, Open Graph, Twitter Cards) per route
- **Structured_Data_Service**: The service that generates and injects JSON-LD schema.org markup into rendered pages
- **Sitemap_Generator**: The NestJS backend service that produces a sitemap.xml file containing all indexable URLs
- **Robots_Controller**: The NestJS backend controller that serves the robots.txt file with crawl directives
- **Canonical_URL**: The preferred URL for a page, communicated via a link rel="canonical" tag to prevent duplicate content issues
- **Prerender_Service**: The service that generates static HTML snapshots for critical pages at build time or on a schedule
- **SEO_API**: The NestJS backend API endpoints that provide SEO metadata (titles, descriptions, structured data) for frontend pages
- **Listing**: A product advertisement posted by a seller, containing title, description, price, images, location, and category
- **Category**: A hierarchical classification (up to 3 levels) used to organize listings
- **Seller_Profile**: A public-facing page displaying a seller's information, verification status, and active listings
- **Open_Graph_Tags**: HTML meta tags following the Open Graph protocol used by Facebook, WhatsApp, and other platforms for link previews
- **Twitter_Cards**: HTML meta tags specific to Twitter/X for controlling how shared links appear in tweets
- **JSON_LD**: JavaScript Object Notation for Linked Data, a method of encoding structured data using schema.org vocabulary in script tags

## Requirements

### Requirement 1: Server-Side Rendering Setup

**User Story:** As a search engine crawler, I want to receive fully rendered HTML when requesting marketplace pages, so that I can index the content without executing JavaScript.

#### Acceptance Criteria

1. WHEN a request is received from any HTTP client, THE SSR_Engine SHALL return fully rendered HTML containing the page content within 3 seconds
2. THE SSR_Engine SHALL render all public routes including home, listing detail, category listings, search results, seller profile, and static pages
3. WHILE the SSR_Engine is rendering a page, THE SSR_Engine SHALL fetch required data from the backend API and include it in the rendered HTML
4. IF the SSR_Engine encounters a rendering error, THEN THE SSR_Engine SHALL return a fallback client-side rendered page with appropriate HTTP status code
5. THE SSR_Engine SHALL transfer server-fetched state to the client to prevent duplicate API calls during hydration
6. WHEN a page is rendered on the server, THE SSR_Engine SHALL exclude browser-only APIs (localStorage, window, document.addEventListener) from server execution paths

### Requirement 2: Dynamic Meta Tags

**User Story:** As a marketplace operator, I want each page to have unique, descriptive meta tags, so that search engines display accurate titles and descriptions in search results.

#### Acceptance Criteria

1. WHEN the home page is rendered, THE Meta_Service SHALL set the title to "marketplace.pk - Buy & Sell in Pakistan" and a description summarizing the marketplace
2. WHEN a listing detail page is rendered, THE Meta_Service SHALL set the title to "{listing.title} - {listing.price.currency} {listing.price.amount} | marketplace.pk" and the description to a truncated version of the listing description (maximum 160 characters)
3. WHEN a category page is rendered, THE Meta_Service SHALL set the title to "{category.name} - Buy & Sell {category.name} in Pakistan | marketplace.pk" and a description referencing the category
4. WHEN a search results page is rendered, THE Meta_Service SHALL set the title to "Search: {query} | marketplace.pk" and a description summarizing the search context
5. WHEN a seller profile page is rendered, THE Meta_Service SHALL set the title to "{seller.name} - Seller Profile | marketplace.pk" and a description including the seller city and listing count
6. WHEN a static page is rendered, THE Meta_Service SHALL set a unique title and description specific to that page (about, terms, privacy, contact, careers, press, trust-safety, selling-tips, cookies)
7. THE Meta_Service SHALL set a fallback title of "marketplace.pk" and a generic marketplace description for any page that does not have specific meta tag configuration

### Requirement 3: Open Graph and Twitter Card Tags

**User Story:** As a user sharing a listing on social media, I want the shared link to display a rich preview with image, title, and description, so that the listing attracts more clicks.

#### Acceptance Criteria

1. WHEN a listing detail page is rendered, THE Meta_Service SHALL set Open Graph tags including og:title, og:description, og:image (first listing image URL), og:url (canonical URL), og:type ("product"), and og:site_name ("marketplace.pk")
2. WHEN a listing detail page is rendered, THE Meta_Service SHALL set Twitter Card tags including twitter:card ("summary_large_image"), twitter:title, twitter:description, and twitter:image
3. WHEN a category page is rendered, THE Meta_Service SHALL set Open Graph tags with og:type ("website"), og:title, og:description, and og:url
4. WHEN a seller profile page is rendered, THE Meta_Service SHALL set Open Graph tags with og:type ("profile"), og:title, og:description, og:image (seller avatar URL), and og:url
5. WHEN the home page is rendered, THE Meta_Service SHALL set Open Graph tags with og:type ("website"), og:title, og:description, og:image (marketplace logo URL), and og:url
6. IF a listing has no images, THEN THE Meta_Service SHALL use a default marketplace placeholder image for og:image and twitter:image

### Requirement 4: Structured Data (JSON-LD)

**User Story:** As a marketplace operator, I want listing pages to include schema.org structured data, so that search engines can display rich snippets (price, availability, reviews) in search results.

#### Acceptance Criteria

1. WHEN a listing detail page is rendered, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "Product" type including name, description, image, offers (price, currency, availability), and seller information
2. WHEN a listing has reviews, THE Structured_Data_Service SHALL include an "aggregateRating" property with ratingValue and reviewCount in the Product structured data
3. WHEN a category page is rendered, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "ItemList" type containing the listed items
4. WHEN the home page is rendered, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "WebSite" type including the site name, URL, and a "SearchAction" pointing to the search page
5. WHEN a seller profile page is rendered, THE Structured_Data_Service SHALL inject a JSON-LD script tag with schema.org "Person" or "Organization" type including the seller name and location
6. THE Structured_Data_Service SHALL inject BreadcrumbList structured data on category pages and listing detail pages reflecting the navigation hierarchy
7. THE Structured_Data_Service SHALL produce valid JSON-LD that passes the Google Rich Results Test validation

### Requirement 5: Canonical URLs

**User Story:** As a marketplace operator, I want each page to declare its canonical URL, so that search engines consolidate ranking signals and avoid indexing duplicate content.

#### Acceptance Criteria

1. THE Meta_Service SHALL set a link rel="canonical" tag on every public page pointing to the preferred URL
2. WHEN a listing detail page is rendered with a slug-id URL pattern, THE Meta_Service SHALL set the canonical URL to "https://marketplace.pk/listings/{slug}-{id}"
3. WHEN a category page is rendered, THE Meta_Service SHALL set the canonical URL to "https://marketplace.pk/categories/{slug}"
4. WHEN a search results page is rendered with pagination parameters, THE Meta_Service SHALL set the canonical URL to the first page of the search results (without page parameter)
5. WHEN a seller profile page is rendered, THE Meta_Service SHALL set the canonical URL to "https://marketplace.pk/seller/{id}"
6. IF a page is accessed with query parameters that do not change content (tracking parameters, session IDs), THEN THE Meta_Service SHALL set the canonical URL without those parameters

### Requirement 6: Sitemap Generation

**User Story:** As a marketplace operator, I want an automatically generated sitemap.xml, so that search engines can discover and crawl all public pages efficiently.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL produce a valid XML sitemap conforming to the sitemaps.org protocol
2. THE Sitemap_Generator SHALL include URLs for the home page, all active category pages, all active listing detail pages, all seller profile pages with active listings, and all static pages
3. WHEN a listing detail URL is included, THE Sitemap_Generator SHALL set the lastmod date to the listing updatedAt timestamp
4. THE Sitemap_Generator SHALL set priority values: home page (1.0), listing detail pages (0.8), category pages (0.7), seller profiles (0.5), static pages (0.3)
5. WHEN the total number of URLs exceeds 50,000, THE Sitemap_Generator SHALL split the sitemap into multiple files and produce a sitemap index file
6. THE Sitemap_Generator SHALL regenerate the sitemap on a configurable schedule (default: every 6 hours)
7. WHEN a new listing is created or an existing listing status changes, THE Sitemap_Generator SHALL include or exclude the listing URL in the next generation cycle
8. THE Sitemap_Generator SHALL serve the sitemap at the path "/sitemap.xml" via an HTTP GET endpoint

### Requirement 7: Robots.txt Configuration

**User Story:** As a marketplace operator, I want a robots.txt file that guides search engine crawlers, so that they index public content and avoid private or duplicate pages.

#### Acceptance Criteria

1. THE Robots_Controller SHALL serve a robots.txt file at the path "/robots.txt" via an HTTP GET endpoint
2. THE Robots_Controller SHALL allow all crawlers to access public pages: home, listings, categories, seller profiles, search, and static pages
3. THE Robots_Controller SHALL disallow all crawlers from accessing private pages: /profile, /favorites, /messaging, /admin, /auth, /listings/create, /listings/my, and /listings/:id/edit
4. THE Robots_Controller SHALL include a Sitemap directive pointing to "https://marketplace.pk/sitemap.xml"
5. THE Robots_Controller SHALL set a Crawl-delay directive of 1 second for all user agents

### Requirement 8: Prerendering Critical Pages

**User Story:** As a marketplace operator, I want critical high-traffic pages to be prerendered, so that they load instantly for both users and search engine crawlers.

#### Acceptance Criteria

1. THE Prerender_Service SHALL generate static HTML for the home page, all top-level category pages (level 1), and all static pages (about, terms, privacy, contact, careers, press, trust-safety, selling-tips, cookies)
2. THE Prerender_Service SHALL regenerate prerendered pages on a configurable schedule (default: every 1 hour for the home page, every 24 hours for static pages)
3. WHEN a prerendered page exists, THE SSR_Engine SHALL serve the prerendered HTML instead of performing on-demand server-side rendering
4. IF a prerendered page is stale (older than the configured TTL), THEN THE SSR_Engine SHALL perform on-demand SSR and trigger a background re-prerender

### Requirement 9: SEO API Endpoints

**User Story:** As a frontend developer, I want backend API endpoints that provide SEO metadata for each page type, so that the SSR engine can set accurate meta tags without duplicating business logic.

#### Acceptance Criteria

1. WHEN a GET request is made to "/api/seo/listing/{id}", THE SEO_API SHALL return the listing title, truncated description, first image URL, price, currency, category breadcrumb, seller name, average rating, and review count
2. WHEN a GET request is made to "/api/seo/category/{slug}", THE SEO_API SHALL return the category name, description, breadcrumb path, and listing count
3. WHEN a GET request is made to "/api/seo/seller/{id}", THE SEO_API SHALL return the seller name, city, member since date, verification status, and active listing count
4. WHEN a GET request is made to "/api/seo/home", THE SEO_API SHALL return the site title, description, and featured category names
5. IF the requested resource does not exist, THEN THE SEO_API SHALL return a 404 status code with an appropriate error message
6. THE SEO_API SHALL respond within 200 milliseconds for cached data and within 500 milliseconds for uncached data
7. THE SEO_API SHALL cache responses using Redis with a configurable TTL (default: 5 minutes for listings, 30 minutes for categories, 1 hour for static content)

### Requirement 10: SEO-Friendly URL Structure

**User Story:** As a marketplace operator, I want all public URLs to be clean and descriptive, so that search engines and users can understand page content from the URL.

#### Acceptance Criteria

1. THE SSR_Engine SHALL serve listing detail pages at the URL pattern "/listings/{slugified-title}-{id}" where the slug is derived from the listing title
2. THE SSR_Engine SHALL serve category pages at the URL pattern "/categories/{slug}" where the slug matches the category slug field
3. THE SSR_Engine SHALL serve seller profile pages at the URL pattern "/seller/{id}"
4. THE SSR_Engine SHALL serve search results at the URL pattern "/search?q={query}" with optional filter parameters
5. WHEN a listing title contains non-ASCII characters (Urdu text), THE Meta_Service SHALL generate a URL-safe slug using transliteration or omission of non-Latin characters
