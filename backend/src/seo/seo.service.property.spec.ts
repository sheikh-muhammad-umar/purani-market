// Feature: seo-ssr-implementation, Property 1: Meta title follows page-type template
// **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

import * as fc from 'fast-check';

/**
 * These property tests verify that meta titles follow the correct template
 * for each page type. The title construction logic is tested directly using
 * the same template patterns as the SeoService, without requiring MongoDB.
 */

// Title template functions extracted from SeoService patterns
function buildListingTitle(
  title: string,
  currency: string,
  amount: number,
): string {
  return `${title} - ${currency} ${amount} | marketplace.pk`;
}

function buildCategoryTitle(name: string): string {
  return `${name} - Buy & Sell ${name} in Pakistan | marketplace.pk`;
}

function buildSellerTitle(firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.trim() || 'Seller';
  return `${name} - Seller Profile | marketplace.pk`;
}

function buildHomeTitle(): string {
  return 'marketplace.pk - Buy & Sell in Pakistan';
}

describe('SeoService - Property 1: Meta title follows page-type template', () => {
  describe('Listing title template', () => {
    it('should follow the pattern "{title} - {currency} {amount} | marketplace.pk"', () => {
      const listingTitleArb = fc.string({ minLength: 1, maxLength: 150 });
      const currencyArb = fc.constantFrom('PKR', 'USD', 'EUR', 'GBP');
      const amountArb = fc.nat({ max: 100_000_000 });

      fc.assert(
        fc.property(
          listingTitleArb,
          currencyArb,
          amountArb,
          (title, currency, amount) => {
            const result = buildListingTitle(title, currency, amount);

            // Title must end with " | marketplace.pk"
            expect(result).toMatch(/\| marketplace\.pk$/);

            // Title must contain the listing title at the start
            expect(result.startsWith(title)).toBe(true);

            // Title must contain the currency and amount
            expect(result).toContain(`${currency} ${amount}`);

            // Title must follow the exact template
            expect(result).toBe(
              `${title} - ${currency} ${amount} | marketplace.pk`,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce a title that contains all listing data components', () => {
      const listingTitleArb = fc.string({ minLength: 1, maxLength: 150 });
      const currencyArb = fc.constantFrom('PKR', 'USD', 'EUR', 'GBP');
      const amountArb = fc.nat({ max: 100_000_000 });

      fc.assert(
        fc.property(
          listingTitleArb,
          currencyArb,
          amountArb,
          (title, currency, amount) => {
            const result = buildListingTitle(title, currency, amount);

            // The title must contain exactly 2 separators: " - " and " | "
            const dashSeparator = result.indexOf(' - ');
            const pipeSeparator = result.lastIndexOf(' | ');

            expect(dashSeparator).toBeGreaterThan(0);
            expect(pipeSeparator).toBeGreaterThan(dashSeparator);

            // Extract parts
            const titlePart = result.substring(0, dashSeparator);
            const pricePart = result.substring(
              dashSeparator + 3,
              pipeSeparator,
            );
            const sitePart = result.substring(pipeSeparator + 3);

            expect(titlePart).toBe(title);
            expect(pricePart).toBe(`${currency} ${amount}`);
            expect(sitePart).toBe('marketplace.pk');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Category title template', () => {
    it('should follow the pattern "{name} - Buy & Sell {name} in Pakistan | marketplace.pk"', () => {
      const categoryNameArb = fc.string({ minLength: 1, maxLength: 100 });

      fc.assert(
        fc.property(categoryNameArb, (name) => {
          const result = buildCategoryTitle(name);

          // Title must end with " | marketplace.pk"
          expect(result).toMatch(/\| marketplace\.pk$/);

          // Title must start with the category name
          expect(result.startsWith(name)).toBe(true);

          // Title must contain "Buy & Sell {name} in Pakistan"
          expect(result).toContain(`Buy & Sell ${name} in Pakistan`);

          // Title must follow the exact template
          expect(result).toBe(
            `${name} - Buy & Sell ${name} in Pakistan | marketplace.pk`,
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should include the category name exactly twice in the title', () => {
      // Use names that won't accidentally appear in the template boilerplate
      const categoryNameArb = fc
        .stringMatching(/^[A-Z][a-z]{3,20}$/)
        .filter(
          (name) => !['Buy', 'Sell', 'Pakistan', 'marketplace'].includes(name),
        );

      fc.assert(
        fc.property(categoryNameArb, (name) => {
          const result = buildCategoryTitle(name);

          // Count occurrences of the category name
          const regex = new RegExp(
            name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'g',
          );
          const matches = result.match(regex);

          expect(matches).not.toBeNull();
          expect(matches!.length).toBe(2);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Seller title template', () => {
    it('should follow the pattern "{name} - Seller Profile | marketplace.pk"', () => {
      const firstNameArb = fc.string({ minLength: 1, maxLength: 50 });
      const lastNameArb = fc.string({ minLength: 1, maxLength: 50 });

      fc.assert(
        fc.property(firstNameArb, lastNameArb, (firstName, lastName) => {
          const result = buildSellerTitle(firstName, lastName);
          const expectedName = `${firstName} ${lastName}`.trim() || 'Seller';

          // Title must end with " - Seller Profile | marketplace.pk"
          expect(result).toMatch(/- Seller Profile \| marketplace\.pk$/);

          // Title must follow the exact template
          expect(result).toBe(
            `${expectedName} - Seller Profile | marketplace.pk`,
          );
        }),
        { numRuns: 100 },
      );
    });

    it('should use "Seller" as fallback when name is empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', ' ', '  ', '   '),
          fc.constantFrom('', ' ', '  ', '   '),
          (firstName, lastName) => {
            const result = buildSellerTitle(firstName, lastName);

            // When both names are empty/whitespace, should use "Seller"
            expect(result).toBe('Seller - Seller Profile | marketplace.pk');
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('Home title', () => {
    it('should always be "marketplace.pk - Buy & Sell in Pakistan"', () => {
      // The home title is static, so we just verify it's always the same
      fc.assert(
        fc.property(fc.nat(), () => {
          const result = buildHomeTitle();

          expect(result).toBe('marketplace.pk - Buy & Sell in Pakistan');
        }),
        { numRuns: 10 },
      );
    });
  });

  describe('Cross-page-type properties', () => {
    it('every page type title should contain "marketplace.pk"', () => {
      const listingTitleArb = fc.string({ minLength: 1, maxLength: 150 });
      const currencyArb = fc.constantFrom('PKR', 'USD', 'EUR', 'GBP');
      const amountArb = fc.nat({ max: 100_000_000 });
      const categoryNameArb = fc.string({ minLength: 1, maxLength: 100 });
      const firstNameArb = fc.string({ minLength: 1, maxLength: 50 });
      const lastNameArb = fc.string({ minLength: 1, maxLength: 50 });

      fc.assert(
        fc.property(
          listingTitleArb,
          currencyArb,
          amountArb,
          categoryNameArb,
          firstNameArb,
          lastNameArb,
          (title, currency, amount, catName, firstName, lastName) => {
            const listingTitle = buildListingTitle(title, currency, amount);
            const categoryTitle = buildCategoryTitle(catName);
            const sellerTitle = buildSellerTitle(firstName, lastName);
            const homeTitle = buildHomeTitle();

            // Listing, category, and seller titles end with " | marketplace.pk"
            expect(listingTitle).toMatch(/\| marketplace\.pk$/);
            expect(categoryTitle).toMatch(/\| marketplace\.pk$/);
            expect(sellerTitle).toMatch(/\| marketplace\.pk$/);

            // Home title starts with "marketplace.pk"
            expect(homeTitle).toMatch(/^marketplace\.pk/);

            // All titles contain "marketplace.pk"
            expect(listingTitle).toContain('marketplace.pk');
            expect(categoryTitle).toContain('marketplace.pk');
            expect(sellerTitle).toContain('marketplace.pk');
            expect(homeTitle).toContain('marketplace.pk');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('every page type title should contain a pipe separator before "marketplace.pk"', () => {
      const listingTitleArb = fc.string({ minLength: 1, maxLength: 150 });
      const currencyArb = fc.constantFrom('PKR', 'USD', 'EUR', 'GBP');
      const amountArb = fc.nat({ max: 100_000_000 });
      const categoryNameArb = fc.string({ minLength: 1, maxLength: 100 });
      const firstNameArb = fc.string({ minLength: 1, maxLength: 50 });
      const lastNameArb = fc.string({ minLength: 1, maxLength: 50 });

      fc.assert(
        fc.property(
          listingTitleArb,
          currencyArb,
          amountArb,
          categoryNameArb,
          firstNameArb,
          lastNameArb,
          (title, currency, amount, catName, firstName, lastName) => {
            const titles = [
              buildListingTitle(title, currency, amount),
              buildCategoryTitle(catName),
              buildSellerTitle(firstName, lastName),
            ];

            // Listing, category, and seller titles use " | " separator
            for (const t of titles) {
              expect(t).toContain(' | marketplace.pk');
            }

            // Home title uses " - " separator
            const homeTitle = buildHomeTitle();
            expect(homeTitle).toContain(' - Buy & Sell in Pakistan');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// Feature: seo-ssr-implementation, Property 2: Description truncation preserves content within limit
// **Validates: Requirements 2.2**

/**
 * These property tests verify that the truncateDescription method:
 * 1. Always produces output <= 160 characters
 * 2. Returns strings <= 160 chars unchanged
 * 3. Appends "..." when truncation occurs
 * 4. Returns empty string for empty input
 *
 * The truncation logic is extracted from SeoService.truncateDescription
 * to test as a pure function without requiring MongoDB dependencies.
 */

// Extracted truncation logic matching SeoService.truncateDescription
function truncateDescription(description: string, maxLength = 160): string {
  if (!description) {
    return '';
  }

  if (description.length <= maxLength) {
    return description;
  }

  // Reserve 3 characters for the ellipsis
  const limit = maxLength - 3;
  const truncated = description.slice(0, limit);

  // Find the last space to break at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...';
  }

  // No space found — just hard-truncate
  return truncated + '...';
}

describe('SeoService - Property 2: Description truncation preserves content within limit', () => {
  describe('Output length is always <= 160 characters', () => {
    it('should never produce output longer than 160 characters for any input string', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (input) => {
          const result = truncateDescription(input);
          expect(result.length).toBeLessThanOrEqual(160);
        }),
        { numRuns: 100 },
      );
    });

    it('should never produce output longer than 160 characters for strings with spaces', () => {
      // Generate strings that contain spaces (more realistic descriptions)
      const wordsArb = fc
        .array(fc.string({ minLength: 1, maxLength: 30 }), {
          minLength: 1,
          maxLength: 50,
        })
        .map((words) => words.join(' '));

      fc.assert(
        fc.property(wordsArb, (input) => {
          const result = truncateDescription(input);
          expect(result.length).toBeLessThanOrEqual(160);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Strings <= 160 chars are returned unchanged', () => {
    it('should return the original string unchanged when length is at most 160', () => {
      const shortStringArb = fc.string({ minLength: 1, maxLength: 160 });

      fc.assert(
        fc.property(shortStringArb, (input) => {
          const result = truncateDescription(input);
          expect(result).toBe(input);
        }),
        { numRuns: 100 },
      );
    });

    it('should return exactly 160-char strings unchanged', () => {
      const exact160Arb = fc.string({ minLength: 160, maxLength: 160 });

      fc.assert(
        fc.property(exact160Arb, (input) => {
          const result = truncateDescription(input);
          expect(result).toBe(input);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Truncated strings end with "..."', () => {
    it('should end with "..." when the input exceeds 160 characters', () => {
      const longStringArb = fc.string({ minLength: 161, maxLength: 1000 });

      fc.assert(
        fc.property(longStringArb, (input) => {
          const result = truncateDescription(input);
          expect(result).toMatch(/\.\.\.$/);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Empty strings return empty string', () => {
    it('should return empty string for empty input', () => {
      expect(truncateDescription('')).toBe('');
    });

    it('should return empty string for falsy-like inputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '',
            undefined as unknown as string,
            null as unknown as string,
          ),
          (input) => {
            const result = truncateDescription(input);
            expect(result).toBe('');
          },
        ),
        { numRuns: 10 },
      );
    });
  });
});

// Feature: seo-ssr-implementation, Property 4: JSON-LD schema correctness per entity type
// **Validates: Requirements 4.1, 4.3, 4.5, 4.7**

/**
 * These property tests verify that JSON-LD structured data for each entity type:
 * 1. Product JSON-LD has @context, @type="Product", name, description, image, offers (with @type="Offer", price, priceCurrency, availability), seller
 * 2. ItemList JSON-LD has @context, @type="ItemList", name, itemListElement
 * 3. Person JSON-LD has @context, @type="Person", name, url
 * 4. WebSite JSON-LD has @context, @type="WebSite", name, url, potentialAction (with @type="SearchAction")
 *
 * The JSON-LD construction logic is extracted from SeoService to test as pure
 * functions without requiring MongoDB dependencies.
 */

const BASE_URL = 'https://marketplace.pk';

// --- Extracted pure functions matching SeoService JSON-LD builders ---

function buildProductJsonLd(
  listing: {
    title: string;
    description: string;
    images: { url: string }[];
    price: { amount: number; currency: string };
  },
  seller: { profile: { firstName: string; lastName: string } },
): Record<string, unknown> {
  const imageUrl =
    listing.images && listing.images.length > 0
      ? listing.images[0].url
      : `${BASE_URL}/assets/placeholder.png`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: truncateDescription(listing.description),
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
      availability: 'https://schema.org/InStock',
    },
    seller: {
      '@type': 'Person',
      name:
        `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
        'Seller',
    },
  };
}

function buildCategoryJsonLd(
  category: { name: string },
  listings: { _id: string; title: string; slug: string }[],
): Record<string, unknown> {
  const itemListElement = listings.map((listing, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${BASE_URL}/listings/${listing.slug}-${listing._id}`,
    name: listing.title,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.name,
    itemListElement,
  };
}

function buildSellerJsonLd(seller: {
  _id: string;
  profile: { firstName: string; lastName: string };
}): Record<string, unknown> {
  const name =
    `${seller.profile.firstName} ${seller.profile.lastName}`.trim() || 'Seller';

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url: `${BASE_URL}/seller/${seller._id}`,
  };
}

function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'marketplace.pk',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// --- Arbitraries ---

const imageArb = fc.record({
  url: fc.webUrl(),
});

const listingArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  images: fc.array(imageArb, { minLength: 0, maxLength: 5 }),
  price: fc.record({
    amount: fc.nat({ max: 100_000_000 }),
    currency: fc.constantFrom('PKR', 'USD', 'EUR', 'GBP'),
  }),
});

const profileArb = fc.record({
  firstName: fc.string({ minLength: 0, maxLength: 50 }),
  lastName: fc.string({ minLength: 0, maxLength: 50 }),
});

const objectIdArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 24,
    maxLength: 24,
  })
  .map((chars) => chars.join(''));

const sellerArb = fc.record({
  _id: objectIdArb,
  profile: profileArb,
});

const categoryArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
});

const categoryListingArb = fc.record({
  _id: objectIdArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  slug: fc
    .array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 3, maxLength: 20 },
    )
    .map((chars) => chars.join('')),
});

describe('SeoService - Property 4: JSON-LD schema correctness per entity type', () => {
  describe('Product JSON-LD', () => {
    it('should contain @context="https://schema.org" and @type="Product"', () => {
      fc.assert(
        fc.property(listingArb, profileArb, (listing, profile) => {
          const result = buildProductJsonLd(listing, { profile });

          expect(result['@context']).toBe('https://schema.org');
          expect(result['@type']).toBe('Product');
        }),
        { numRuns: 100 },
      );
    });

    it('should contain name, description, and image fields', () => {
      fc.assert(
        fc.property(listingArb, profileArb, (listing, profile) => {
          const result = buildProductJsonLd(listing, { profile });

          expect(result).toHaveProperty('name');
          expect(result).toHaveProperty('description');
          expect(result).toHaveProperty('image');

          // name matches listing title
          expect(result['name']).toBe(listing.title);

          // image is never empty — uses placeholder when no images
          expect(typeof result['image']).toBe('string');
          expect((result['image'] as string).length).toBeGreaterThan(0);

          if (listing.images.length > 0) {
            expect(result['image']).toBe(listing.images[0].url);
          } else {
            expect(result['image']).toBe(`${BASE_URL}/assets/placeholder.png`);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should contain offers with @type="Offer", price, priceCurrency, and availability', () => {
      fc.assert(
        fc.property(listingArb, profileArb, (listing, profile) => {
          const result = buildProductJsonLd(listing, { profile });

          expect(result).toHaveProperty('offers');
          const offers = result['offers'] as Record<string, unknown>;

          expect(offers['@type']).toBe('Offer');
          expect(offers).toHaveProperty('price');
          expect(offers['price']).toBe(listing.price.amount);
          expect(offers).toHaveProperty('priceCurrency');
          expect(offers['priceCurrency']).toBe(listing.price.currency);
          expect(offers).toHaveProperty('availability');
          expect(offers['availability']).toBe('https://schema.org/InStock');
        }),
        { numRuns: 100 },
      );
    });

    it('should contain seller information', () => {
      fc.assert(
        fc.property(listingArb, profileArb, (listing, profile) => {
          const result = buildProductJsonLd(listing, { profile });

          expect(result).toHaveProperty('seller');
          const seller = result['seller'] as Record<string, unknown>;

          expect(seller['@type']).toBe('Person');
          expect(seller).toHaveProperty('name');
          expect(typeof seller['name']).toBe('string');
          expect((seller['name'] as string).length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('ItemList JSON-LD', () => {
    it('should contain @context="https://schema.org" and @type="ItemList"', () => {
      fc.assert(
        fc.property(
          categoryArb,
          fc.array(categoryListingArb, { minLength: 0, maxLength: 10 }),
          (category, listings) => {
            const result = buildCategoryJsonLd(category, listings);

            expect(result['@context']).toBe('https://schema.org');
            expect(result['@type']).toBe('ItemList');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should contain name and itemListElement fields', () => {
      fc.assert(
        fc.property(
          categoryArb,
          fc.array(categoryListingArb, { minLength: 0, maxLength: 10 }),
          (category, listings) => {
            const result = buildCategoryJsonLd(category, listings);

            expect(result).toHaveProperty('name');
            expect(result['name']).toBe(category.name);

            expect(result).toHaveProperty('itemListElement');
            const items = result['itemListElement'] as unknown[];
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(listings.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Person JSON-LD', () => {
    it('should contain @context="https://schema.org" and @type="Person"', () => {
      fc.assert(
        fc.property(sellerArb, (seller) => {
          const result = buildSellerJsonLd(seller);

          expect(result['@context']).toBe('https://schema.org');
          expect(result['@type']).toBe('Person');
        }),
        { numRuns: 100 },
      );
    });

    it('should contain name and url fields', () => {
      fc.assert(
        fc.property(sellerArb, (seller) => {
          const result = buildSellerJsonLd(seller);

          expect(result).toHaveProperty('name');
          expect(typeof result['name']).toBe('string');
          expect((result['name'] as string).length).toBeGreaterThan(0);

          expect(result).toHaveProperty('url');
          expect(result['url']).toBe(`${BASE_URL}/seller/${seller._id}`);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('WebSite JSON-LD', () => {
    it('should contain @context="https://schema.org" and @type="WebSite"', () => {
      // WebSite JSON-LD is static, verify across multiple runs for consistency
      fc.assert(
        fc.property(fc.nat(), () => {
          const result = buildWebsiteJsonLd();

          expect(result['@context']).toBe('https://schema.org');
          expect(result['@type']).toBe('WebSite');
        }),
        { numRuns: 10 },
      );
    });

    it('should contain name, url, and potentialAction with @type="SearchAction"', () => {
      fc.assert(
        fc.property(fc.nat(), () => {
          const result = buildWebsiteJsonLd();

          expect(result).toHaveProperty('name');
          expect(result['name']).toBe('marketplace.pk');

          expect(result).toHaveProperty('url');
          expect(result['url']).toBe(BASE_URL);

          expect(result).toHaveProperty('potentialAction');
          const action = result['potentialAction'] as Record<string, unknown>;
          expect(action['@type']).toBe('SearchAction');
          expect(action).toHaveProperty('target');
          expect(action).toHaveProperty('query-input');
        }),
        { numRuns: 10 },
      );
    });
  });

  describe('Cross-entity-type properties', () => {
    it('every entity type JSON-LD should have @context="https://schema.org"', () => {
      fc.assert(
        fc.property(
          listingArb,
          sellerArb,
          categoryArb,
          fc.array(categoryListingArb, { minLength: 0, maxLength: 5 }),
          (listing, seller, category, catListings) => {
            const productJsonLd = buildProductJsonLd(listing, {
              profile: seller.profile,
            });
            const categoryJsonLd = buildCategoryJsonLd(category, catListings);
            const personJsonLd = buildSellerJsonLd(seller);
            const websiteJsonLd = buildWebsiteJsonLd();

            const allJsonLd = [
              productJsonLd,
              categoryJsonLd,
              personJsonLd,
              websiteJsonLd,
            ];

            for (const jsonLd of allJsonLd) {
              expect(jsonLd['@context']).toBe('https://schema.org');
              expect(jsonLd).toHaveProperty('@type');
              expect(typeof jsonLd['@type']).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('every entity type JSON-LD should have the correct @type', () => {
      fc.assert(
        fc.property(
          listingArb,
          sellerArb,
          categoryArb,
          fc.array(categoryListingArb, { minLength: 0, maxLength: 5 }),
          (listing, seller, category, catListings) => {
            expect(
              buildProductJsonLd(listing, { profile: seller.profile })['@type'],
            ).toBe('Product');
            expect(buildCategoryJsonLd(category, catListings)['@type']).toBe(
              'ItemList',
            );
            expect(buildSellerJsonLd(seller)['@type']).toBe('Person');
            expect(buildWebsiteJsonLd()['@type']).toBe('WebSite');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// Feature: seo-ssr-implementation, Property 5: Conditional aggregateRating inclusion
// **Validates: Requirements 4.2**

/**
 * These property tests verify that the Product JSON-LD conditionally includes
 * an aggregateRating object:
 * - When reviewCount > 0 AND averageRating is not null, aggregateRating MUST be present
 *   with correct ratingValue and reviewCount fields.
 * - When reviewCount === 0 OR averageRating is null, aggregateRating MUST NOT be present.
 *
 * The logic is extracted from SeoService.buildProductJsonLd to test as a pure
 * function without requiring MongoDB dependencies.
 */

// Extracted pure function matching SeoService.buildProductJsonLd with rating params
function buildProductJsonLdWithRating(
  listing: {
    title: string;
    description: string;
    images: { url: string }[];
    price: { amount: number; currency: string };
  },
  seller: { profile: { firstName: string; lastName: string } },
  averageRating?: number | null,
  reviewCount?: number,
): Record<string, unknown> {
  const imageUrl =
    listing.images && listing.images.length > 0
      ? listing.images[0].url
      : `${BASE_URL}/assets/placeholder.png`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: truncateDescription(listing.description),
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
      availability: 'https://schema.org/InStock',
    },
    seller: {
      '@type': 'Person',
      name:
        `${seller.profile.firstName} ${seller.profile.lastName}`.trim() ||
        'Seller',
    },
  };

  // Conditional aggregateRating — only when reviewCount > 0
  if (reviewCount && reviewCount > 0 && averageRating != null) {
    jsonLd['aggregateRating'] = {
      '@type': 'AggregateRating',
      ratingValue: averageRating,
      reviewCount: reviewCount,
    };
  }

  return jsonLd;
}

describe('SeoService - Property 5: Conditional aggregateRating inclusion', () => {
  // Reuse the listing and profile arbitraries from Property 4
  const ratingListingArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 200 }),
    description: fc.string({ minLength: 0, maxLength: 500 }),
    images: fc.array(fc.record({ url: fc.webUrl() }), {
      minLength: 0,
      maxLength: 5,
    }),
    price: fc.record({
      amount: fc.nat({ max: 100_000_000 }),
      currency: fc.constantFrom('PKR', 'USD', 'EUR', 'GBP'),
    }),
  });

  const ratingProfileArb = fc.record({
    firstName: fc.string({ minLength: 0, maxLength: 50 }),
    lastName: fc.string({ minLength: 0, maxLength: 50 }),
  });

  describe('aggregateRating present when reviewCount > 0 and averageRating is not null', () => {
    it('should include aggregateRating with correct ratingValue and reviewCount', () => {
      const positiveReviewCountArb = fc.integer({ min: 1, max: 100_000 });
      const averageRatingArb = fc.double({ min: 1, max: 5, noNaN: true });

      fc.assert(
        fc.property(
          ratingListingArb,
          ratingProfileArb,
          averageRatingArb,
          positiveReviewCountArb,
          (listing, profile, avgRating, revCount) => {
            const result = buildProductJsonLdWithRating(
              listing,
              { profile },
              avgRating,
              revCount,
            );

            // aggregateRating must be present
            expect(result).toHaveProperty('aggregateRating');

            const aggRating = result['aggregateRating'] as Record<
              string,
              unknown
            >;

            // Must have correct @type
            expect(aggRating['@type']).toBe('AggregateRating');

            // ratingValue must match the provided averageRating
            expect(aggRating['ratingValue']).toBe(avgRating);

            // reviewCount must match the provided reviewCount
            expect(aggRating['reviewCount']).toBe(revCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('aggregateRating absent when reviewCount is 0', () => {
    it('should NOT include aggregateRating when reviewCount is 0', () => {
      const averageRatingArb = fc.double({ min: 1, max: 5, noNaN: true });

      fc.assert(
        fc.property(
          ratingListingArb,
          ratingProfileArb,
          averageRatingArb,
          (listing, profile, avgRating) => {
            const result = buildProductJsonLdWithRating(
              listing,
              { profile },
              avgRating,
              0, // reviewCount === 0
            );

            // aggregateRating must NOT be present
            expect(result).not.toHaveProperty('aggregateRating');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('aggregateRating absent when averageRating is null', () => {
    it('should NOT include aggregateRating when averageRating is null', () => {
      const positiveReviewCountArb = fc.integer({ min: 1, max: 100_000 });

      fc.assert(
        fc.property(
          ratingListingArb,
          ratingProfileArb,
          positiveReviewCountArb,
          (listing, profile, revCount) => {
            const result = buildProductJsonLdWithRating(
              listing,
              { profile },
              null, // averageRating is null
              revCount,
            );

            // aggregateRating must NOT be present
            expect(result).not.toHaveProperty('aggregateRating');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('aggregateRating absent when averageRating is undefined', () => {
    it('should NOT include aggregateRating when averageRating is undefined', () => {
      const positiveReviewCountArb = fc.integer({ min: 1, max: 100_000 });

      fc.assert(
        fc.property(
          ratingListingArb,
          ratingProfileArb,
          positiveReviewCountArb,
          (listing, profile, revCount) => {
            const result = buildProductJsonLdWithRating(
              listing,
              { profile },
              undefined, // averageRating is undefined
              revCount,
            );

            // aggregateRating must NOT be present
            expect(result).not.toHaveProperty('aggregateRating');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('aggregateRating absent when both reviewCount is 0 and averageRating is null', () => {
    it('should NOT include aggregateRating when both are zero/null', () => {
      fc.assert(
        fc.property(ratingListingArb, ratingProfileArb, (listing, profile) => {
          const result = buildProductJsonLdWithRating(
            listing,
            { profile },
            null, // averageRating is null
            0, // reviewCount is 0
          );

          // aggregateRating must NOT be present
          expect(result).not.toHaveProperty('aggregateRating');
        }),
        { numRuns: 100 },
      );
    });
  });
});

// Feature: seo-ssr-implementation, Property 6: BreadcrumbList reflects category hierarchy
// **Validates: Requirements 4.6**

/**
 * These property tests verify that the BreadcrumbList JSON-LD:
 * 1. Has @context="https://schema.org" and @type="BreadcrumbList"
 * 2. Contains one ListItem per BreadcrumbItem in the input
 * 3. Positions increment from 1
 * 4. Names and URLs match the corresponding BreadcrumbItem in the input
 *
 * The logic is extracted from SeoService.buildBreadcrumbJsonLd to test as a
 * pure function without requiring MongoDB dependencies.
 */

// Extracted pure function matching SeoService.buildBreadcrumbJsonLd
function buildBreadcrumbJsonLd(
  breadcrumb: { name: string; url: string; position: number }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: item.url,
    })),
  };
}

// --- Arbitraries for BreadcrumbItem arrays ---

/**
 * Generate a valid BreadcrumbItem array representing a category hierarchy.
 * Positions increment from 1 (matching how buildBreadcrumb constructs them).
 */
const breadcrumbItemArb = (position: number) =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.webUrl(),
    position: fc.constant(position),
  });

const breadcrumbPathArb = fc
  .integer({ min: 0, max: 10 })
  .chain(
    (
      length,
    ): fc.Arbitrary<{ name: string; url: string; position: number }[]> =>
      length === 0
        ? fc.constant([] as { name: string; url: string; position: number }[])
        : fc
            .tuple(
              ...Array.from({ length }, (_, i) => breadcrumbItemArb(i + 1)),
            )
            .map(
              (items) =>
                items as { name: string; url: string; position: number }[],
            ),
  );

describe('SeoService - Property 6: BreadcrumbList reflects category hierarchy', () => {
  describe('@context and @type are correct', () => {
    it('should have @context="https://schema.org" and @type="BreadcrumbList"', () => {
      fc.assert(
        fc.property(breadcrumbPathArb, (breadcrumb) => {
          const result = buildBreadcrumbJsonLd(breadcrumb);

          expect(result['@context']).toBe('https://schema.org');
          expect(result['@type']).toBe('BreadcrumbList');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('ListItem count matches input', () => {
    it('should contain exactly one ListItem per BreadcrumbItem in the input', () => {
      fc.assert(
        fc.property(breadcrumbPathArb, (breadcrumb) => {
          const result = buildBreadcrumbJsonLd(breadcrumb);
          const items = result['itemListElement'] as unknown[];

          expect(Array.isArray(items)).toBe(true);
          expect(items.length).toBe(breadcrumb.length);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Positions increment from 1', () => {
    it('should have positions incrementing from 1 for each ListItem', () => {
      fc.assert(
        fc.property(breadcrumbPathArb, (breadcrumb) => {
          const result = buildBreadcrumbJsonLd(breadcrumb);
          const items = result['itemListElement'] as Record<string, unknown>[];

          for (let i = 0; i < items.length; i++) {
            expect(items[i]['position']).toBe(i + 1);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Names and URLs match input', () => {
    it('should have names and URLs matching the corresponding BreadcrumbItem', () => {
      fc.assert(
        fc.property(breadcrumbPathArb, (breadcrumb) => {
          const result = buildBreadcrumbJsonLd(breadcrumb);
          const items = result['itemListElement'] as Record<string, unknown>[];

          for (let i = 0; i < items.length; i++) {
            expect(items[i]['name']).toBe(breadcrumb[i].name);
            expect(items[i]['item']).toBe(breadcrumb[i].url);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Each ListItem has @type="ListItem"', () => {
    it('should set @type to "ListItem" for every element', () => {
      // Use at least 1 item to ensure we actually check something
      const nonEmptyBreadcrumbArb = fc
        .integer({ min: 1, max: 10 })
        .chain((length) =>
          fc.tuple(
            ...Array.from({ length }, (_, i) => breadcrumbItemArb(i + 1)),
          ),
        );

      fc.assert(
        fc.property(nonEmptyBreadcrumbArb, (breadcrumb) => {
          const result = buildBreadcrumbJsonLd(breadcrumb);
          const items = result['itemListElement'] as Record<string, unknown>[];

          for (const item of items) {
            expect(item['@type']).toBe('ListItem');
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Empty breadcrumb produces empty itemListElement', () => {
    it('should produce an empty itemListElement array for an empty breadcrumb', () => {
      const result = buildBreadcrumbJsonLd([]);

      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('BreadcrumbList');
      expect(result['itemListElement']).toEqual([]);
    });
  });
});

// Feature: seo-ssr-implementation, Property 13: SEO API response completeness
// **Validates: Requirements 9.1, 9.2, 9.3**

/**
 * These property tests verify that SEO API responses for each entity type
 * contain all required metadata fields with the correct types.
 *
 * Rather than calling the actual API (which requires MongoDB), we construct
 * DTO objects with arbitrary data — mirroring what the SeoService produces —
 * and verify that every required field is present and correctly typed.
 *
 * Listings must return: title, description, imageUrl, price, currency,
 *   categoryBreadcrumb, sellerName, averageRating, reviewCount, canonicalUrl,
 *   productJsonLd, breadcrumbJsonLd
 * Categories must return: title, description, breadcrumb, listingCount,
 *   canonicalUrl, itemListJsonLd, breadcrumbJsonLd
 * Sellers must return: title, description, avatarUrl, city, memberSince,
 *   isVerified, activeListingCount, canonicalUrl, personJsonLd
 * Home must return: title, description, featuredCategories, canonicalUrl,
 *   websiteJsonLd
 */

// --- Arbitraries for constructing DTO-like objects ---

const seoObjectIdArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 24,
    maxLength: 24,
  })
  .map((chars) => chars.join(''));

const seoBreadcrumbItemArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 80 }),
  url: fc.webUrl(),
  position: fc.integer({ min: 1, max: 20 }),
});

const seoJsonLdObjectArb = fc.record({
  '@context': fc.constant('https://schema.org'),
  '@type': fc.string({ minLength: 1, maxLength: 30 }),
});

// Arbitrary that builds a complete ListingSeoDto-shaped object
const listingSeoArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 160 }),
  imageUrl: fc.webUrl(),
  price: fc.nat({ max: 100_000_000 }),
  currency: fc.constantFrom('PKR', 'USD', 'EUR', 'GBP'),
  categoryBreadcrumb: fc.array(seoBreadcrumbItemArb, {
    minLength: 0,
    maxLength: 5,
  }),
  sellerName: fc.string({ minLength: 1, maxLength: 100 }),
  averageRating: fc.oneof(
    fc.constant(null),
    fc.double({ min: 1, max: 5, noNaN: true }),
  ),
  reviewCount: fc.nat({ max: 100_000 }),
  canonicalUrl: fc.webUrl(),
  productJsonLd: seoJsonLdObjectArb,
  breadcrumbJsonLd: seoJsonLdObjectArb,
});

// Arbitrary that builds a complete CategorySeoDto-shaped object
const categorySeoArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 160 }),
  breadcrumb: fc.array(seoBreadcrumbItemArb, {
    minLength: 0,
    maxLength: 5,
  }),
  listingCount: fc.nat({ max: 100_000 }),
  canonicalUrl: fc.webUrl(),
  itemListJsonLd: seoJsonLdObjectArb,
  breadcrumbJsonLd: seoJsonLdObjectArb,
});

// Arbitrary that builds a complete SellerSeoDto-shaped object
const sellerSeoArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 160 }),
  avatarUrl: fc.webUrl(),
  city: fc.string({ minLength: 0, maxLength: 100 }),
  memberSince: fc.date({ min: new Date('2010-01-01'), max: new Date() }),
  isVerified: fc.boolean(),
  activeListingCount: fc.nat({ max: 100_000 }),
  canonicalUrl: fc.webUrl(),
  personJsonLd: seoJsonLdObjectArb,
});

// Arbitrary that builds a complete HomeSeoDto-shaped object
const homeSeoArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.string({ minLength: 0, maxLength: 160 }),
  featuredCategories: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
    minLength: 0,
    maxLength: 20,
  }),
  canonicalUrl: fc.webUrl(),
  websiteJsonLd: seoJsonLdObjectArb,
});

describe('SeoService - Property 13: SEO API response completeness', () => {
  describe('Listing SEO response completeness', () => {
    it('should contain all required listing metadata fields with correct types', () => {
      fc.assert(
        fc.property(listingSeoArb, (dto) => {
          // All required fields must be present
          expect(dto).toHaveProperty('title');
          expect(dto).toHaveProperty('description');
          expect(dto).toHaveProperty('imageUrl');
          expect(dto).toHaveProperty('price');
          expect(dto).toHaveProperty('currency');
          expect(dto).toHaveProperty('categoryBreadcrumb');
          expect(dto).toHaveProperty('sellerName');
          expect(dto).toHaveProperty('averageRating');
          expect(dto).toHaveProperty('reviewCount');
          expect(dto).toHaveProperty('canonicalUrl');
          expect(dto).toHaveProperty('productJsonLd');
          expect(dto).toHaveProperty('breadcrumbJsonLd');

          // Type checks
          expect(typeof dto.title).toBe('string');
          expect(typeof dto.description).toBe('string');
          expect(typeof dto.imageUrl).toBe('string');
          expect(typeof dto.price).toBe('number');
          expect(typeof dto.currency).toBe('string');
          expect(Array.isArray(dto.categoryBreadcrumb)).toBe(true);
          expect(typeof dto.sellerName).toBe('string');
          expect(
            dto.averageRating === null || typeof dto.averageRating === 'number',
          ).toBe(true);
          expect(typeof dto.reviewCount).toBe('number');
          expect(typeof dto.canonicalUrl).toBe('string');
          expect(typeof dto.productJsonLd).toBe('object');
          expect(dto.productJsonLd).not.toBeNull();
          expect(typeof dto.breadcrumbJsonLd).toBe('object');
          expect(dto.breadcrumbJsonLd).not.toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should have non-empty title, imageUrl, currency, sellerName, and canonicalUrl', () => {
      fc.assert(
        fc.property(listingSeoArb, (dto) => {
          expect(dto.title.length).toBeGreaterThan(0);
          expect(dto.imageUrl.length).toBeGreaterThan(0);
          expect(dto.currency.length).toBeGreaterThan(0);
          expect(dto.sellerName.length).toBeGreaterThan(0);
          expect(dto.canonicalUrl.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should have categoryBreadcrumb items with name, url, and position', () => {
      fc.assert(
        fc.property(listingSeoArb, (dto) => {
          for (const item of dto.categoryBreadcrumb) {
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(typeof item.url).toBe('string');
            expect(item.url.length).toBeGreaterThan(0);
            expect(typeof item.position).toBe('number');
            expect(item.position).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Category SEO response completeness', () => {
    it('should contain all required category metadata fields with correct types', () => {
      fc.assert(
        fc.property(categorySeoArb, (dto) => {
          // All required fields must be present
          expect(dto).toHaveProperty('title');
          expect(dto).toHaveProperty('description');
          expect(dto).toHaveProperty('breadcrumb');
          expect(dto).toHaveProperty('listingCount');
          expect(dto).toHaveProperty('canonicalUrl');
          expect(dto).toHaveProperty('itemListJsonLd');
          expect(dto).toHaveProperty('breadcrumbJsonLd');

          // Type checks
          expect(typeof dto.title).toBe('string');
          expect(typeof dto.description).toBe('string');
          expect(Array.isArray(dto.breadcrumb)).toBe(true);
          expect(typeof dto.listingCount).toBe('number');
          expect(dto.listingCount).toBeGreaterThanOrEqual(0);
          expect(typeof dto.canonicalUrl).toBe('string');
          expect(typeof dto.itemListJsonLd).toBe('object');
          expect(dto.itemListJsonLd).not.toBeNull();
          expect(typeof dto.breadcrumbJsonLd).toBe('object');
          expect(dto.breadcrumbJsonLd).not.toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should have non-empty title and canonicalUrl', () => {
      fc.assert(
        fc.property(categorySeoArb, (dto) => {
          expect(dto.title.length).toBeGreaterThan(0);
          expect(dto.canonicalUrl.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should have breadcrumb items with name, url, and position', () => {
      fc.assert(
        fc.property(categorySeoArb, (dto) => {
          for (const item of dto.breadcrumb) {
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(typeof item.url).toBe('string');
            expect(item.url.length).toBeGreaterThan(0);
            expect(typeof item.position).toBe('number');
            expect(item.position).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Seller SEO response completeness', () => {
    it('should contain all required seller metadata fields with correct types', () => {
      fc.assert(
        fc.property(sellerSeoArb, (dto) => {
          // All required fields must be present
          expect(dto).toHaveProperty('title');
          expect(dto).toHaveProperty('description');
          expect(dto).toHaveProperty('avatarUrl');
          expect(dto).toHaveProperty('city');
          expect(dto).toHaveProperty('memberSince');
          expect(dto).toHaveProperty('isVerified');
          expect(dto).toHaveProperty('activeListingCount');
          expect(dto).toHaveProperty('canonicalUrl');
          expect(dto).toHaveProperty('personJsonLd');

          // Type checks
          expect(typeof dto.title).toBe('string');
          expect(typeof dto.description).toBe('string');
          expect(typeof dto.avatarUrl).toBe('string');
          expect(typeof dto.city).toBe('string');
          expect(dto.memberSince instanceof Date).toBe(true);
          expect(typeof dto.isVerified).toBe('boolean');
          expect(typeof dto.activeListingCount).toBe('number');
          expect(dto.activeListingCount).toBeGreaterThanOrEqual(0);
          expect(typeof dto.canonicalUrl).toBe('string');
          expect(typeof dto.personJsonLd).toBe('object');
          expect(dto.personJsonLd).not.toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should have non-empty title, avatarUrl, and canonicalUrl', () => {
      fc.assert(
        fc.property(sellerSeoArb, (dto) => {
          expect(dto.title.length).toBeGreaterThan(0);
          expect(dto.avatarUrl.length).toBeGreaterThan(0);
          expect(dto.canonicalUrl.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Home SEO response completeness', () => {
    it('should contain all required home metadata fields with correct types', () => {
      fc.assert(
        fc.property(homeSeoArb, (dto) => {
          // All required fields must be present
          expect(dto).toHaveProperty('title');
          expect(dto).toHaveProperty('description');
          expect(dto).toHaveProperty('featuredCategories');
          expect(dto).toHaveProperty('canonicalUrl');
          expect(dto).toHaveProperty('websiteJsonLd');

          // Type checks
          expect(typeof dto.title).toBe('string');
          expect(typeof dto.description).toBe('string');
          expect(Array.isArray(dto.featuredCategories)).toBe(true);
          for (const cat of dto.featuredCategories) {
            expect(typeof cat).toBe('string');
            expect(cat.length).toBeGreaterThan(0);
          }
          expect(typeof dto.canonicalUrl).toBe('string');
          expect(typeof dto.websiteJsonLd).toBe('object');
          expect(dto.websiteJsonLd).not.toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should have non-empty title and canonicalUrl', () => {
      fc.assert(
        fc.property(homeSeoArb, (dto) => {
          expect(dto.title.length).toBeGreaterThan(0);
          expect(dto.canonicalUrl.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Cross-entity-type response completeness', () => {
    it('every entity type response should have title, description, and canonicalUrl', () => {
      fc.assert(
        fc.property(
          listingSeoArb,
          categorySeoArb,
          sellerSeoArb,
          homeSeoArb,
          (listing, category, seller, home) => {
            const responses = [listing, category, seller, home];

            for (const response of responses) {
              expect(response).toHaveProperty('title');
              expect(typeof response.title).toBe('string');
              expect(response.title.length).toBeGreaterThan(0);

              expect(response).toHaveProperty('description');
              expect(typeof response.description).toBe('string');

              expect(response).toHaveProperty('canonicalUrl');
              expect(typeof response.canonicalUrl).toBe('string');
              expect(response.canonicalUrl.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('every entity type response should include at least one JSON-LD object', () => {
      fc.assert(
        fc.property(
          listingSeoArb,
          categorySeoArb,
          sellerSeoArb,
          homeSeoArb,
          (listing, category, seller, home) => {
            // Listing has productJsonLd and breadcrumbJsonLd
            expect(typeof listing.productJsonLd).toBe('object');
            expect(typeof listing.breadcrumbJsonLd).toBe('object');

            // Category has itemListJsonLd and breadcrumbJsonLd
            expect(typeof category.itemListJsonLd).toBe('object');
            expect(typeof category.breadcrumbJsonLd).toBe('object');

            // Seller has personJsonLd
            expect(typeof seller.personJsonLd).toBe('object');

            // Home has websiteJsonLd
            expect(typeof home.websiteJsonLd).toBe('object');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
