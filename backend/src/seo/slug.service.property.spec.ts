// Feature: seo-ssr-implementation, Property 9: Slug generation produces URL-safe output
// **Validates: Requirements 10.5**

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { SlugService } from './slug.service.js';

describe('SlugService - Property 9: Slug generation produces URL-safe output', () => {
  let service: SlugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlugService],
    }).compile();

    service = module.get<SlugService>(SlugService);
  });

  const URL_SAFE_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it('should produce URL-safe slugs from arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const slug = service.generateSlug(input);

        // Slug must be a non-empty string
        expect(slug.length).toBeGreaterThan(0);

        // Slug must contain only lowercase alphanumeric characters and hyphens
        expect(slug).toMatch(/^[a-z0-9-]+$/);

        // Slug must not start with a hyphen
        expect(slug[0]).not.toBe('-');

        // Slug must not end with a hyphen
        expect(slug[slug.length - 1]).not.toBe('-');

        // Slug must not contain consecutive hyphens
        expect(slug).not.toMatch(/--/);
      }),
      { numRuns: 100 },
    );
  });

  it('should produce URL-safe slugs from unicode strings (including Urdu)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (input) => {
        const slug = service.generateSlug(input);

        // Slug must be a non-empty string
        expect(slug.length).toBeGreaterThan(0);

        // Slug must contain only lowercase alphanumeric characters and hyphens
        expect(slug).toMatch(/^[a-z0-9-]+$/);

        // Slug must not start with a hyphen
        expect(slug[0]).not.toBe('-');

        // Slug must not end with a hyphen
        expect(slug[slug.length - 1]).not.toBe('-');

        // Slug must not contain consecutive hyphens
        expect(slug).not.toMatch(/--/);
      }),
      { numRuns: 100 },
    );
  });

  it('should produce URL-safe slugs from mixed Latin and non-Latin scripts', () => {
    const latinChars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(
        '',
      );
    const urduChars = 'گاڑی فروخت کے لیے ہے پاکستان میں'.split('');
    const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~` '.split('');

    const latinArb = fc
      .array(fc.constantFrom(...latinChars), { minLength: 0, maxLength: 10 })
      .map((arr) => arr.join(''));
    const urduArb = fc
      .array(fc.constantFrom(...urduChars), { minLength: 0, maxLength: 10 })
      .map((arr) => arr.join(''));
    const specialArb = fc
      .array(fc.constantFrom(...specialChars), { minLength: 0, maxLength: 5 })
      .map((arr) => arr.join(''));

    const mixedScriptArb = fc
      .tuple(latinArb, urduArb, specialArb, latinArb)
      .map(
        ([latin1, urdu, special, latin2]) =>
          `${latin1} ${urdu} ${special} ${latin2}`,
      );

    fc.assert(
      fc.property(mixedScriptArb, (input) => {
        const slug = service.generateSlug(input);

        // Slug must be a non-empty string
        expect(slug.length).toBeGreaterThan(0);

        // Slug must contain only lowercase alphanumeric characters and hyphens
        expect(slug).toMatch(/^[a-z0-9-]+$/);

        // Slug must not start with a hyphen
        expect(slug[0]).not.toBe('-');

        // Slug must not end with a hyphen
        expect(slug[slug.length - 1]).not.toBe('-');

        // Slug must not contain consecutive hyphens
        expect(slug).not.toMatch(/--/);
      }),
      { numRuns: 100 },
    );
  });

  it('should produce a valid slug pattern (lowercase alphanumeric segments separated by single hyphens)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (input) => {
        const slug = service.generateSlug(input);

        // The slug must match the full URL-safe pattern:
        // one or more lowercase alphanumeric chars, optionally followed by
        // groups of (single hyphen + one or more lowercase alphanumeric chars)
        // OR it must be the default "listing"
        expect(slug).toMatch(URL_SAFE_SLUG_REGEX);
      }),
      { numRuns: 100 },
    );
  });
});
