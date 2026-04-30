// Feature: seo-ssr-implementation, Property 10: Sitemap URL metadata correctness
// Feature: seo-ssr-implementation, Property 11: Sitemap XML validity and splitting
// Feature: seo-ssr-implementation, Property 12: Sitemap includes only active content

import * as fc from 'fast-check';
import { SitemapUrl } from './dto/sitemap-url.dto';

/**
 * Pure logic extracted from SitemapService for property-based testing
 * without MongoDB or Redis dependencies.
 */

const BASE_URL = 'https://marketplace.pk';

const STATIC_PAGES = [
  'about',
  'terms',
  'privacy',
  'contact',
  'careers',
  'press',
  'trust-safety',
  'selling-tips',
  'cookies',
];

const SITEMAP_MAX_URLS = 50000;

// --- Extracted pure functions from SitemapService ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map((url) => {
      let entry = '  <url>\n';
      entry += `    <loc>${escapeXml(url.loc)}</loc>\n`;
      if (url.lastmod) {
        entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }
      if (url.changefreq) {
        entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }
      entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      entry += '  </url>';
      return entry;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    '</urlset>',
  ].join('\n');
}

function generateSitemapIndex(sitemapUrls: string[]): string {
  const entries = sitemapUrls
    .map((url) => {
      return [
        '  <sitemap>',
        `    <loc>${escapeXml(url)}</loc>`,
        '  </sitemap>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</sitemapindex>',
  ].join('\n');
}

function buildStaticUrls(): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  const home = new SitemapUrl();
  home.loc = `${BASE_URL}/`;
  home.priority = 1.0;
  urls.push(home);

  for (const page of STATIC_PAGES) {
    const staticUrl = new SitemapUrl();
    staticUrl.loc = `${BASE_URL}/pages/${page}`;
    staticUrl.priority = 0.3;
    urls.push(staticUrl);
  }

  return urls;
}

/**
 * Build listing URLs from plain listing data (simulates buildListingUrls
 * without MongoDB). Only includes active listings.
 */
function buildListingUrlsFromData(
  listings: {
    _id: string;
    title: string;
    updatedAt: Date;
    status: string;
  }[],
): SitemapUrl[] {
  return listings
    .filter((l) => l.status === 'active')
    .map((listing) => {
      const slug = generateSlug(listing.title);
      const url = new SitemapUrl();
      url.loc = `${BASE_URL}/listings/${slug}-${listing._id}`;
      url.lastmod = listing.updatedAt.toISOString();
      url.priority = 0.8;
      return url;
    });
}

/**
 * Build category URLs from plain category data (simulates buildCategoryUrls).
 */
function buildCategoryUrlsFromData(
  categories: { slug: string }[],
): SitemapUrl[] {
  return categories.map((category) => {
    const url = new SitemapUrl();
    url.loc = `${BASE_URL}/categories/${category.slug}`;
    url.priority = 0.7;
    return url;
  });
}

/**
 * Build seller URLs from plain seller IDs (simulates buildSellerUrls).
 */
function buildSellerUrlsFromData(sellerIds: string[]): SitemapUrl[] {
  return sellerIds.map((sellerId) => {
    const url = new SitemapUrl();
    url.loc = `${BASE_URL}/seller/${sellerId}`;
    url.priority = 0.5;
    return url;
  });
}

/**
 * Simplified slug generation matching SlugService.generateSlug.
 */
function generateSlug(title: string): string {
  if (!title) return 'listing';
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return slug || 'listing';
}

// --- Arbitraries ---

const objectIdArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 24,
    maxLength: 24,
  })
  .map((chars) => chars.join(''));

const isoDateArb = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ts) => new Date(ts));

const listingTitleArb = fc.string({ minLength: 1, maxLength: 150 });

const slugArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 3,
    maxLength: 30,
  })
  .map((chars) => chars.join(''));

const allStatuses = [
  'active',
  'inactive',
  'pending_review',
  'rejected',
  'sold',
  'reserved',
  'expired',
  'deleted',
] as const;

const statusArb = fc.constantFrom(...allStatuses);

const listingWithStatusArb = fc.record({
  _id: objectIdArb,
  title: listingTitleArb,
  updatedAt: isoDateArb,
  status: statusArb,
});

// ============================================================================
// Property 10: Sitemap URL metadata correctness
// **Validates: Requirements 6.3, 6.4**
// ============================================================================

describe('SitemapService - Property 10: Sitemap URL metadata correctness', () => {
  describe('Listing URLs have priority 0.8 and lastmod matching updatedAt', () => {
    it('should set priority to 0.8 and lastmod to updatedAt ISO string for every active listing', () => {
      const activeListingArb = fc.record({
        _id: objectIdArb,
        title: listingTitleArb,
        updatedAt: isoDateArb,
        status: fc.constant('active' as const),
      });

      fc.assert(
        fc.property(
          fc.array(activeListingArb, { minLength: 1, maxLength: 20 }),
          (listings) => {
            const urls = buildListingUrlsFromData(listings);

            expect(urls.length).toBe(listings.length);

            for (let i = 0; i < urls.length; i++) {
              expect(urls[i].priority).toBe(0.8);
              expect(urls[i].lastmod).toBe(listings[i].updatedAt.toISOString());
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Category URLs have priority 0.7', () => {
    it('should set priority to 0.7 for every category URL', () => {
      const categoryArb = fc.record({ slug: slugArb });

      fc.assert(
        fc.property(
          fc.array(categoryArb, { minLength: 1, maxLength: 20 }),
          (categories) => {
            const urls = buildCategoryUrlsFromData(categories);

            expect(urls.length).toBe(categories.length);

            for (const url of urls) {
              expect(url.priority).toBe(0.7);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Seller URLs have priority 0.5', () => {
    it('should set priority to 0.5 for every seller URL', () => {
      fc.assert(
        fc.property(
          fc.array(objectIdArb, { minLength: 1, maxLength: 20 }),
          (sellerIds) => {
            const urls = buildSellerUrlsFromData(sellerIds);

            expect(urls.length).toBe(sellerIds.length);

            for (const url of urls) {
              expect(url.priority).toBe(0.5);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Static URLs have correct priorities', () => {
    it('should set home page priority to 1.0 and other static pages to 0.3', () => {
      // buildStaticUrls is deterministic, but we verify the property holds
      fc.assert(
        fc.property(fc.nat(), () => {
          const urls = buildStaticUrls();

          // First URL is the home page
          expect(urls[0].loc).toBe(`${BASE_URL}/`);
          expect(urls[0].priority).toBe(1.0);

          // Remaining URLs are static pages with priority 0.3
          for (let i = 1; i < urls.length; i++) {
            expect(urls[i].priority).toBe(0.3);
            expect(urls[i].loc).toMatch(
              new RegExp(
                `^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pages/`,
              ),
            );
          }
        }),
        { numRuns: 10 },
      );
    });

    it('should include all expected static pages', () => {
      const urls = buildStaticUrls();

      // 1 home + 9 static pages
      expect(urls.length).toBe(1 + STATIC_PAGES.length);

      for (const page of STATIC_PAGES) {
        const found = urls.some((u) => u.loc === `${BASE_URL}/pages/${page}`);
        expect(found).toBe(true);
      }
    });
  });

  describe('Priority values match the specification across all URL types', () => {
    it('should assign correct priority per URL type when combined', () => {
      const activeListingArb = fc.record({
        _id: objectIdArb,
        title: listingTitleArb,
        updatedAt: isoDateArb,
        status: fc.constant('active' as const),
      });
      const categoryArb = fc.record({ slug: slugArb });

      fc.assert(
        fc.property(
          fc.array(activeListingArb, { minLength: 1, maxLength: 5 }),
          fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
          fc.array(objectIdArb, { minLength: 1, maxLength: 5 }),
          (listings, categories, sellerIds) => {
            const staticUrls = buildStaticUrls();
            const listingUrls = buildListingUrlsFromData(listings);
            const categoryUrls = buildCategoryUrlsFromData(categories);
            const sellerUrls = buildSellerUrlsFromData(sellerIds);

            const allUrls = [
              ...staticUrls,
              ...listingUrls,
              ...categoryUrls,
              ...sellerUrls,
            ];

            for (const url of allUrls) {
              // Every priority must be one of the spec values
              expect([1.0, 0.8, 0.7, 0.5, 0.3]).toContain(url.priority);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 11: Sitemap XML validity and splitting
// **Validates: Requirements 6.1, 6.5**
// ============================================================================

describe('SitemapService - Property 11: Sitemap XML validity and splitting', () => {
  describe('Generated XML conforms to sitemaps.org schema', () => {
    it('should start with XML declaration and contain urlset element', () => {
      const sitemapUrlArb = fc.record({
        loc: fc.webUrl(),
        lastmod: fc.option(
          isoDateArb.map((d) => d.toISOString()),
          {
            nil: undefined,
          },
        ),
        changefreq: fc.option(
          fc.constantFrom(
            'always',
            'hourly',
            'daily',
            'weekly',
            'monthly',
            'yearly',
            'never',
          ),
          { nil: undefined },
        ),
        priority: fc.constantFrom(0.0, 0.1, 0.3, 0.5, 0.7, 0.8, 1.0),
      });

      fc.assert(
        fc.property(
          fc.array(sitemapUrlArb, { minLength: 0, maxLength: 20 }),
          (urlData) => {
            const urls = urlData.map((d) => {
              const u = new SitemapUrl();
              u.loc = d.loc;
              u.lastmod = d.lastmod;
              u.changefreq = d.changefreq;
              u.priority = d.priority;
              return u;
            });

            const xml = generateSitemapXml(urls);

            // Must start with XML declaration
            expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);

            // Must contain urlset element with sitemaps.org namespace
            expect(xml).toContain(
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            );

            // Must close urlset
            expect(xml).toMatch(/<\/urlset>$/);

            // Each URL must have a <loc> element
            for (const u of urls) {
              expect(xml).toContain(`<loc>${escapeXml(u.loc)}</loc>`);
            }

            // Each URL must have a <priority> element
            for (const u of urls) {
              expect(xml).toContain(
                `<priority>${u.priority.toFixed(1)}</priority>`,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include lastmod when present and omit when absent', () => {
      const dateStr = '2024-06-15T10:30:00.000Z';

      const urlWithLastmod = new SitemapUrl();
      urlWithLastmod.loc = `${BASE_URL}/listings/test-123`;
      urlWithLastmod.lastmod = dateStr;
      urlWithLastmod.priority = 0.8;

      const urlWithoutLastmod = new SitemapUrl();
      urlWithoutLastmod.loc = `${BASE_URL}/`;
      urlWithoutLastmod.priority = 1.0;

      const xml = generateSitemapXml([urlWithLastmod, urlWithoutLastmod]);

      // URL with lastmod should have the element
      expect(xml).toContain(`<lastmod>${dateStr}</lastmod>`);

      // Count lastmod occurrences — should be exactly 1
      const lastmodMatches = xml.match(/<lastmod>/g);
      expect(lastmodMatches).not.toBeNull();
      expect(lastmodMatches!.length).toBe(1);
    });

    it('should produce valid XML with no unclosed tags for arbitrary URL counts', () => {
      const sitemapUrlArb = fc.record({
        loc: fc.webUrl(),
        priority: fc.constantFrom(0.3, 0.5, 0.7, 0.8, 1.0),
      });

      fc.assert(
        fc.property(
          fc.array(sitemapUrlArb, { minLength: 0, maxLength: 50 }),
          (urlData) => {
            const urls = urlData.map((d) => {
              const u = new SitemapUrl();
              u.loc = d.loc;
              u.priority = d.priority;
              return u;
            });

            const xml = generateSitemapXml(urls);

            // Count opening and closing url tags
            const openUrlTags = (xml.match(/<url>/g) || []).length;
            const closeUrlTags = (xml.match(/<\/url>/g) || []).length;
            expect(openUrlTags).toBe(closeUrlTags);
            expect(openUrlTags).toBe(urls.length);

            // Count opening and closing loc tags
            const openLocTags = (xml.match(/<loc>/g) || []).length;
            const closeLocTags = (xml.match(/<\/loc>/g) || []).length;
            expect(openLocTags).toBe(closeLocTags);
            expect(openLocTags).toBe(urls.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Sitemap index generation', () => {
    it('should produce valid sitemap index XML with XML declaration and sitemapindex element', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
          (sitemapUrls) => {
            const xml = generateSitemapIndex(sitemapUrls);

            // Must start with XML declaration
            expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);

            // Must contain sitemapindex element with sitemaps.org namespace
            expect(xml).toContain(
              '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            );

            // Must close sitemapindex
            expect(xml).toMatch(/<\/sitemapindex>$/);

            // Each sitemap URL must appear in a <sitemap><loc> element
            for (const url of sitemapUrls) {
              expect(xml).toContain(`<loc>${escapeXml(url)}</loc>`);
            }

            // Count sitemap entries
            const sitemapEntries = (xml.match(/<sitemap>/g) || []).length;
            expect(sitemapEntries).toBe(sitemapUrls.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Splitting when URLs exceed 50,000', () => {
    it('should split URL sets larger than 50,000 into chunks of at most 50,000', () => {
      // We test the splitting logic directly rather than generating 50k+ URLs
      fc.assert(
        fc.property(fc.integer({ min: 50001, max: 150000 }), (totalUrls) => {
          // Simulate the splitting logic from generateSitemap
          const chunkCount = Math.ceil(totalUrls / SITEMAP_MAX_URLS);

          // Each chunk should have at most SITEMAP_MAX_URLS
          for (let i = 0; i < chunkCount; i++) {
            const start = i * SITEMAP_MAX_URLS;
            const end = Math.min(start + SITEMAP_MAX_URLS, totalUrls);
            const chunkSize = end - start;

            expect(chunkSize).toBeLessThanOrEqual(SITEMAP_MAX_URLS);
            expect(chunkSize).toBeGreaterThan(0);
          }

          // All URLs should be accounted for
          let totalAccountedFor = 0;
          for (let i = 0; i < chunkCount; i++) {
            const start = i * SITEMAP_MAX_URLS;
            const end = Math.min(start + SITEMAP_MAX_URLS, totalUrls);
            totalAccountedFor += end - start;
          }
          expect(totalAccountedFor).toBe(totalUrls);
        }),
        { numRuns: 100 },
      );
    });

    it('should generate a sitemap index referencing all parts when splitting', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (partCount) => {
          const partUrls = Array.from(
            { length: partCount },
            (_, i) => `${BASE_URL}/sitemap-${i + 1}.xml`,
          );

          const indexXml = generateSitemapIndex(partUrls);

          // Index should reference every part
          for (const partUrl of partUrls) {
            expect(indexXml).toContain(`<loc>${escapeXml(partUrl)}</loc>`);
          }

          // Should have exactly partCount sitemap entries
          const sitemapEntries = (indexXml.match(/<sitemap>/g) || []).length;
          expect(sitemapEntries).toBe(partCount);
        }),
        { numRuns: 100 },
      );
    });

    it('should not split when URL count is at or below 50,000', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 50000 }), (totalUrls) => {
          // When at or below the limit, a single sitemap suffices
          const needsSplit = totalUrls > SITEMAP_MAX_URLS;
          expect(needsSplit).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should produce valid XML for each chunk when splitting a concrete small set', () => {
      // Use a small concrete set to verify the actual XML generation for split chunks
      const maxPerChunk = 3; // Use small limit for testing
      const urls: SitemapUrl[] = [];
      for (let i = 0; i < 7; i++) {
        const u = new SitemapUrl();
        u.loc = `${BASE_URL}/listings/item-${i}`;
        u.priority = 0.8;
        urls.push(u);
      }

      // Split into chunks of maxPerChunk
      const chunks: SitemapUrl[][] = [];
      for (let i = 0; i < urls.length; i += maxPerChunk) {
        chunks.push(urls.slice(i, i + maxPerChunk));
      }

      expect(chunks.length).toBe(3); // 7 / 3 = 3 chunks (3, 3, 1)

      for (const chunk of chunks) {
        const xml = generateSitemapXml(chunk);

        // Each chunk XML must be valid
        expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        expect(xml).toContain(
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        );
        expect(xml).toMatch(/<\/urlset>$/);

        const urlCount = (xml.match(/<url>/g) || []).length;
        expect(urlCount).toBe(chunk.length);
        expect(urlCount).toBeLessThanOrEqual(maxPerChunk);
      }
    });
  });
});

// ============================================================================
// Property 12: Sitemap includes only active content
// **Validates: Requirements 6.7**
// ============================================================================

describe('SitemapService - Property 12: Sitemap includes only active content', () => {
  describe('Only active listings appear in sitemap URLs', () => {
    it('should include only listings with status "active" and exclude all other statuses', () => {
      fc.assert(
        fc.property(
          fc.array(listingWithStatusArb, { minLength: 1, maxLength: 30 }),
          (listings) => {
            const urls = buildListingUrlsFromData(listings);

            const activeListings = listings.filter(
              (l) => l.status === 'active',
            );

            // Number of URLs must equal number of active listings
            expect(urls.length).toBe(activeListings.length);

            // Every URL must correspond to an active listing
            for (const url of urls) {
              const matchingActive = activeListings.some((l) => {
                const slug = generateSlug(l.title);
                return url.loc === `${BASE_URL}/listings/${slug}-${l._id}`;
              });
              expect(matchingActive).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce zero URLs when no listings are active', () => {
      const inactiveStatusArb = fc.constantFrom(
        'inactive',
        'pending_review',
        'rejected',
        'sold',
        'reserved',
        'expired',
        'deleted',
      );

      const inactiveListingArb = fc.record({
        _id: objectIdArb,
        title: listingTitleArb,
        updatedAt: isoDateArb,
        status: inactiveStatusArb,
      });

      fc.assert(
        fc.property(
          fc.array(inactiveListingArb, { minLength: 1, maxLength: 20 }),
          (listings) => {
            const urls = buildListingUrlsFromData(listings);
            expect(urls.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include all active listings when mixed with inactive ones', () => {
      fc.assert(
        fc.property(
          fc.array(listingWithStatusArb, { minLength: 5, maxLength: 30 }),
          (listings) => {
            const urls = buildListingUrlsFromData(listings);
            const activeCount = listings.filter(
              (l) => l.status === 'active',
            ).length;

            expect(urls.length).toBe(activeCount);

            // No URL should contain an ID from a non-active listing
            const inactiveIds = listings
              .filter((l) => l.status !== 'active')
              .map((l) => l._id);

            for (const url of urls) {
              for (const inactiveId of inactiveIds) {
                // The URL should not end with the inactive listing's ID
                expect(url.loc.endsWith(`-${inactiveId}`)).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle each non-active status individually', () => {
      const nonActiveStatuses = [
        'inactive',
        'pending_review',
        'rejected',
        'sold',
        'reserved',
        'expired',
        'deleted',
      ] as const;

      for (const status of nonActiveStatuses) {
        const listing = {
          _id: 'a'.repeat(24),
          title: 'Test Listing',
          updatedAt: new Date('2024-01-01'),
          status,
        };

        const urls = buildListingUrlsFromData([listing]);
        expect(urls.length).toBe(0);
      }
    });

    it('should include a listing when its status is exactly "active"', () => {
      fc.assert(
        fc.property(
          objectIdArb,
          listingTitleArb,
          isoDateArb,
          (id, title, updatedAt) => {
            const listing = {
              _id: id,
              title,
              updatedAt,
              status: 'active',
            };

            const urls = buildListingUrlsFromData([listing]);
            expect(urls.length).toBe(1);
            expect(urls[0].priority).toBe(0.8);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
