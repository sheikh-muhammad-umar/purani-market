// Feature: seo-ssr-implementation, Property 8: Canonical URL strips extraneous parameters
// **Validates: Requirements 5.4, 5.6**

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { SlugService } from './slug.service.js';

/**
 * Tracking and pagination parameters that should be stripped.
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'fbclid',
  'gclid',
  'page',
  'offset',
];

/**
 * Content-relevant parameters that should be preserved.
 */
const CONTENT_PARAMS = [
  'q',
  'category',
  'sort',
  'minPrice',
  'maxPrice',
  'condition',
  'location',
];

/**
 * Arbitrary for a non-empty alphanumeric param value.
 */
const paramValueArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 20,
  })
  .map((chars) => chars.join(''));

/**
 * Arbitrary for a relative URL path (e.g. /listings/some-slug-abc123).
 */
const relativePathArb = fc
  .constantFrom(
    '/listings/item-123',
    '/categories/electronics',
    '/seller/abc123',
    '/search',
    '/',
  )
  .map((p) => p);

describe('SlugService - Property 8: Canonical URL strips extraneous parameters', () => {
  let service: SlugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlugService],
    }).compile();

    service = module.get<SlugService>(SlugService);
  });

  it('should strip all tracking/pagination params from URLs', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        fc.subarray(TRACKING_PARAMS, { minLength: 1 }),
        fc.array(paramValueArb, { minLength: 1, maxLength: 7 }),
        (basePath, trackingKeys, values) => {
          // Build a URL with only tracking params
          const params = new URLSearchParams();
          trackingKeys.forEach((key, i) => {
            params.set(key, values[i % values.length]);
          });

          const inputUrl = `${basePath}?${params.toString()}`;
          const result = service.stripTrackingParams(inputUrl);

          // All tracking params should be removed
          for (const key of trackingKeys) {
            expect(result).not.toContain(`${key}=`);
          }

          // Result should not contain a query string (all params were tracking)
          expect(result).toEqual(basePath);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should preserve content-relevant params', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        fc.subarray(CONTENT_PARAMS, { minLength: 1 }),
        fc.array(paramValueArb, { minLength: 1, maxLength: 7 }),
        (basePath, contentKeys, values) => {
          // Build a URL with only content-relevant params
          const params = new URLSearchParams();
          contentKeys.forEach((key, i) => {
            params.set(key, values[i % values.length]);
          });

          const inputUrl = `${basePath}?${params.toString()}`;
          const result = service.stripTrackingParams(inputUrl);

          // All content params should be preserved
          const resultUrl = new URL(result, 'https://placeholder.local');
          for (let i = 0; i < contentKeys.length; i++) {
            const key = contentKeys[i];
            const value = values[i % values.length];
            expect(resultUrl.searchParams.get(key)).toEqual(value);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should strip tracking params while preserving content params in mixed URLs', () => {
    fc.assert(
      fc.property(
        relativePathArb,
        fc.subarray(TRACKING_PARAMS, { minLength: 1 }),
        fc.subarray(CONTENT_PARAMS, { minLength: 1 }),
        fc.array(paramValueArb, { minLength: 1, maxLength: 14 }),
        (basePath, trackingKeys, contentKeys, values) => {
          // Build a URL with both tracking and content params
          const params = new URLSearchParams();
          let valIdx = 0;
          trackingKeys.forEach((key) => {
            params.set(key, values[valIdx % values.length]);
            valIdx++;
          });
          contentKeys.forEach((key) => {
            params.set(key, values[valIdx % values.length]);
            valIdx++;
          });

          const inputUrl = `${basePath}?${params.toString()}`;
          const result = service.stripTrackingParams(inputUrl);

          // Tracking params should be removed
          const resultUrl = new URL(result, 'https://placeholder.local');
          for (const key of trackingKeys) {
            expect(resultUrl.searchParams.has(key)).toBe(false);
          }

          // Content params should be preserved with correct values
          valIdx = trackingKeys.length;
          for (const key of contentKeys) {
            const expectedValue = values[valIdx % values.length];
            expect(resultUrl.searchParams.get(key)).toEqual(expectedValue);
            valIdx++;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return URLs with no params unchanged', () => {
    fc.assert(
      fc.property(relativePathArb, (basePath) => {
        const result = service.stripTrackingParams(basePath);
        expect(result).toEqual(basePath);
      }),
      { numRuns: 100 },
    );
  });
});
