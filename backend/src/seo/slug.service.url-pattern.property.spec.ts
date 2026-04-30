// Feature: seo-ssr-implementation, Property 7: URL pattern correctness per entity type
// **Validates: Requirements 5.2, 5.3, 5.5, 10.1, 10.2, 10.3, 10.4**

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { Types } from 'mongoose';
import { SlugService } from './slug.service.js';

describe('SlugService - Property 7: URL pattern correctness per entity type', () => {
  let service: SlugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlugService],
    }).compile();

    service = module.get<SlugService>(SlugService);
  });

  /**
   * Arbitrary for listing titles: any non-empty string including unicode.
   */
  const titleArb = fc.string({ minLength: 1 });

  /**
   * Arbitrary for category slugs: lowercase alphanumeric strings with hyphens,
   * matching what a real category slug looks like.
   */
  const alphanumChars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const categorySlugArb = fc
    .array(
      fc
        .array(fc.constantFrom(...alphanumChars), {
          minLength: 1,
          maxLength: 15,
        })
        .map((chars) => chars.join('')),
      { minLength: 1, maxLength: 5 },
    )
    .map((parts) => parts.join('-'));

  /**
   * Arbitrary for seller IDs: hex strings matching MongoDB ObjectId format.
   */
  const sellerIdArb = fc
    .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
      minLength: 24,
      maxLength: 24,
    })
    .map((chars) => chars.join(''));

  it('generateListingUrl should produce URLs matching /listings/{slug}-{id} pattern', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const objectId = new Types.ObjectId();
        const listing = { _id: objectId, title };

        const url = service.generateListingUrl(listing);
        const id = objectId.toString();
        const slug = service.generateSlug(title);

        // URL must start with /listings/
        expect(url).toMatch(/^\/listings\//);

        // URL must end with -{id} where id is the ObjectId hex string
        expect(url).toEqual(`/listings/${slug}-${id}`);

        // The slug portion must be URL-safe (lowercase alphanumeric and hyphens)
        const pathAfterPrefix = url.slice('/listings/'.length);
        const slugPortion = pathAfterPrefix.slice(
          0,
          pathAfterPrefix.length - id.length - 1,
        );
        expect(slugPortion).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);

        // The id portion must be a valid 24-char hex string (ObjectId)
        const idPortion = pathAfterPrefix.slice(-24);
        expect(idPortion).toMatch(/^[a-f0-9]{24}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('generateCategoryUrl should produce URLs matching /categories/{slug} pattern', () => {
    fc.assert(
      fc.property(categorySlugArb, (slug) => {
        const category = { slug };

        const url = service.generateCategoryUrl(category);

        // URL must start with /categories/
        expect(url).toMatch(/^\/categories\//);

        // URL must exactly match /categories/{slug}
        expect(url).toEqual(`/categories/${slug}`);

        // The slug portion must be preserved exactly
        const slugPortion = url.slice('/categories/'.length);
        expect(slugPortion).toEqual(slug);
      }),
      { numRuns: 100 },
    );
  });

  it('generateSellerUrl should produce URLs matching /seller/{id} pattern', () => {
    fc.assert(
      fc.property(sellerIdArb, (sellerId) => {
        const url = service.generateSellerUrl(sellerId);

        // URL must start with /seller/
        expect(url).toMatch(/^\/seller\//);

        // URL must exactly match /seller/{id}
        expect(url).toEqual(`/seller/${sellerId}`);

        // The id portion must be preserved exactly
        const idPortion = url.slice('/seller/'.length);
        expect(idPortion).toEqual(sellerId);
      }),
      { numRuns: 100 },
    );
  });

  it('generateListingUrl should produce consistent URLs for the same listing', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const objectId = new Types.ObjectId();
        const listing = { _id: objectId, title };

        const url1 = service.generateListingUrl(listing);
        const url2 = service.generateListingUrl(listing);

        // Same input must produce same output
        expect(url1).toEqual(url2);
      }),
      { numRuns: 100 },
    );
  });

  it('all URL generators should produce paths starting with the correct prefix', () => {
    fc.assert(
      fc.property(
        titleArb,
        categorySlugArb,
        sellerIdArb,
        (title, catSlug, sellerId) => {
          const objectId = new Types.ObjectId();

          const listingUrl = service.generateListingUrl({
            _id: objectId,
            title,
          });
          const categoryUrl = service.generateCategoryUrl({ slug: catSlug });
          const sellerUrl = service.generateSellerUrl(sellerId);

          // Each URL type has a distinct prefix
          expect(listingUrl.startsWith('/listings/')).toBe(true);
          expect(categoryUrl.startsWith('/categories/')).toBe(true);
          expect(sellerUrl.startsWith('/seller/')).toBe(true);

          // No URL should contain double slashes (except protocol, but these are relative)
          expect(listingUrl).not.toMatch(/\/\//);
          expect(categoryUrl).not.toMatch(/\/\//);
          expect(sellerUrl).not.toMatch(/\/\//);
        },
      ),
      { numRuns: 100 },
    );
  });
});
