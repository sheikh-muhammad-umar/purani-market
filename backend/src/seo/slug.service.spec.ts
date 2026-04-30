import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SlugService } from './slug.service.js';

describe('SlugService', () => {
  let service: SlugService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlugService],
    }).compile();

    service = module.get<SlugService>(SlugService);
  });

  describe('generateSlug', () => {
    it('should convert a simple English title to a slug', () => {
      expect(service.generateSlug('iPhone 15 Pro Max')).toBe(
        'iphone-15-pro-max',
      );
    });

    it('should handle special characters', () => {
      expect(service.generateSlug('Hello, World! @#$%')).toBe('hello-world');
    });

    it('should handle accented characters via NFD normalization', () => {
      expect(service.generateSlug('café résumé')).toBe('cafe-resume');
    });

    it('should handle Urdu text by omitting non-Latin characters', () => {
      expect(service.generateSlug('گاڑی فروخت کے لیے')).toBe('listing');
    });

    it('should handle mixed Urdu and English text', () => {
      expect(service.generateSlug('Honda Civic گاڑی 2024')).toBe(
        'honda-civic-2024',
      );
    });

    it('should not produce leading hyphens', () => {
      const slug = service.generateSlug('---leading');
      expect(slug).not.toMatch(/^-/);
      expect(slug).toBe('leading');
    });

    it('should not produce trailing hyphens', () => {
      const slug = service.generateSlug('trailing---');
      expect(slug).not.toMatch(/-$/);
      expect(slug).toBe('trailing');
    });

    it('should not produce consecutive hyphens', () => {
      const slug = service.generateSlug('hello   world');
      expect(slug).not.toMatch(/--/);
      expect(slug).toBe('hello-world');
    });

    it('should return "listing" for empty string', () => {
      expect(service.generateSlug('')).toBe('listing');
    });

    it('should return "listing" for only special characters', () => {
      expect(service.generateSlug('!@#$%^&*()')).toBe('listing');
    });

    it('should produce lowercase output', () => {
      const slug = service.generateSlug('UPPERCASE TITLE');
      expect(slug).toBe('uppercase-title');
    });

    it('should handle numbers correctly', () => {
      expect(service.generateSlug('Model 3 2024')).toBe('model-3-2024');
    });
  });

  describe('generateListingUrl', () => {
    it('should return /listings/{slug}-{id} pattern', () => {
      const id = new Types.ObjectId();
      const listing = { _id: id, title: 'iPhone 15 Pro' };
      expect(service.generateListingUrl(listing)).toBe(
        `/listings/iphone-15-pro-${id.toString()}`,
      );
    });

    it('should handle Urdu-only titles with default slug', () => {
      const id = new Types.ObjectId();
      const listing = { _id: id, title: 'گاڑی فروخت' };
      expect(service.generateListingUrl(listing)).toBe(
        `/listings/listing-${id.toString()}`,
      );
    });
  });

  describe('generateCategoryUrl', () => {
    it('should return /categories/{slug} pattern', () => {
      expect(service.generateCategoryUrl({ slug: 'electronics' })).toBe(
        '/categories/electronics',
      );
    });

    it('should preserve the category slug as-is', () => {
      expect(service.generateCategoryUrl({ slug: 'mobile-phones' })).toBe(
        '/categories/mobile-phones',
      );
    });
  });

  describe('generateSellerUrl', () => {
    it('should return /seller/{id} pattern', () => {
      const id = new Types.ObjectId().toString();
      expect(service.generateSellerUrl(id)).toBe(`/seller/${id}`);
    });
  });

  describe('stripTrackingParams', () => {
    it('should remove utm_source parameter', () => {
      expect(
        service.stripTrackingParams(
          'https://marketplace.pk/search?q=phone&utm_source=google',
        ),
      ).toBe('https://marketplace.pk/search?q=phone');
    });

    it('should remove multiple tracking parameters', () => {
      const result = service.stripTrackingParams(
        'https://marketplace.pk/search?q=phone&utm_source=google&utm_medium=cpc&utm_campaign=summer',
      );
      expect(result).toBe('https://marketplace.pk/search?q=phone');
    });

    it('should remove fbclid and gclid', () => {
      const result = service.stripTrackingParams(
        'https://marketplace.pk/listings/test-123?fbclid=abc&gclid=def',
      );
      expect(result).toBe('https://marketplace.pk/listings/test-123');
    });

    it('should remove page and offset pagination params', () => {
      const result = service.stripTrackingParams(
        'https://marketplace.pk/search?q=phone&page=3&offset=20',
      );
      expect(result).toBe('https://marketplace.pk/search?q=phone');
    });

    it('should preserve content-relevant parameters', () => {
      const result = service.stripTrackingParams(
        'https://marketplace.pk/search?q=phone&category=electronics&sort=price',
      );
      expect(result).toBe(
        'https://marketplace.pk/search?q=phone&category=electronics&sort=price',
      );
    });

    it('should handle URLs with no query parameters', () => {
      expect(
        service.stripTrackingParams('https://marketplace.pk/listings/test-123'),
      ).toBe('https://marketplace.pk/listings/test-123');
    });

    it('should handle relative URLs', () => {
      const result = service.stripTrackingParams(
        '/search?q=phone&utm_source=google',
      );
      expect(result).toBe('/search?q=phone');
    });

    it('should return original URL if all params are tracking params', () => {
      const result = service.stripTrackingParams(
        'https://marketplace.pk/search?utm_source=google&page=2',
      );
      expect(result).toBe('https://marketplace.pk/search');
    });

    it('should handle malformed URLs gracefully', () => {
      const malformed = 'not-a-url';
      expect(service.stripTrackingParams(malformed)).toBe(malformed);
    });
  });
});
