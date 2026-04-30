import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SeoService } from './seo.service.js';
import { SlugService } from './slug.service.js';
import { ProductListing } from '../listings/schemas/product-listing.schema.js';
import { Category } from '../categories/schemas/category.schema.js';
import { User } from '../users/schemas/user.schema.js';

describe('SeoService - Endpoint Methods', () => {
  let service: SeoService;
  let mockRedis: Record<string, jest.Mock>;

  const listingId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    title: 'iPhone 15 Pro Max',
    description:
      'Brand new iPhone 15 Pro Max with 256GB storage. Excellent condition.',
    price: { amount: 450000, currency: 'PKR' },
    sellerId,
    categoryId,
    categoryPath: [categoryId],
    images: [{ url: 'https://cdn.marketplace.pk/img1.jpg', sortOrder: 0 }],
    status: 'active',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  };

  const mockSeller = {
    _id: sellerId,
    profile: {
      firstName: 'Ali',
      lastName: 'Khan',
      avatar: 'https://cdn.marketplace.pk/avatar.jpg',
      city: 'Lahore',
    },
    idVerified: true,
    createdAt: new Date('2023-06-01'),
  };

  const mockCategory = {
    _id: categoryId,
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    level: 2,
    parentId: null,
    isActive: true,
    sortOrder: 1,
  };

  // Mock model helpers
  const createMockModel = () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  });

  const chainable = (result: any) => ({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(result),
    }),
  });

  const chainableWithLimit = (result: any) => ({
    limit: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(result),
      }),
    }),
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(result),
    }),
  });

  const chainableSort = (result: any) => ({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(result),
      }),
    }),
  });

  let mockListingModel: ReturnType<typeof createMockModel>;
  let mockCategoryModel: ReturnType<typeof createMockModel>;
  let mockUserModel: ReturnType<typeof createMockModel>;

  beforeEach(async () => {
    mockListingModel = createMockModel();
    mockCategoryModel = createMockModel();
    mockUserModel = createMockModel();

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoService,
        SlugService,
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SeoService>(SeoService);
  });

  describe('getListingSeo', () => {
    it('should return listing SEO data with correct title template', async () => {
      mockListingModel.findById.mockReturnValue(chainable(mockListing));
      mockUserModel.findById.mockReturnValue(chainable(mockSeller));
      mockCategoryModel.find.mockReturnValue(chainable([mockCategory]));

      const result = await service.getListingSeo(listingId.toString());

      expect(result.title).toBe(
        'iPhone 15 Pro Max - PKR 450000 | marketplace.pk',
      );
      expect(result.description).toBe(mockListing.description);
      expect(result.imageUrl).toBe('https://cdn.marketplace.pk/img1.jpg');
      expect(result.price).toBe(450000);
      expect(result.currency).toBe('PKR');
      expect(result.sellerName).toBe('Ali Khan');
      expect(result.averageRating).toBeNull();
      expect(result.reviewCount).toBe(0);
      expect(result.canonicalUrl).toContain('https://marketplace.pk/listings/');
      expect(result.canonicalUrl).toContain(listingId.toString());
      expect(result.productJsonLd).toBeDefined();
      expect((result.productJsonLd as any)['@type']).toBe('Product');
      expect(result.breadcrumbJsonLd).toBeDefined();
    });

    it('should use placeholder image when listing has no images', async () => {
      const listingNoImages = { ...mockListing, images: [] };
      mockListingModel.findById.mockReturnValue(chainable(listingNoImages));
      mockUserModel.findById.mockReturnValue(chainable(mockSeller));
      mockCategoryModel.find.mockReturnValue(chainable([mockCategory]));

      const result = await service.getListingSeo(listingId.toString());

      expect(result.imageUrl).toBe(
        'https://marketplace.pk/assets/placeholder.png',
      );
    });

    it('should throw NotFoundException when listing not found', async () => {
      mockListingModel.findById.mockReturnValue(chainable(null));

      await expect(service.getListingSeo(listingId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when seller not found', async () => {
      mockListingModel.findById.mockReturnValue(chainable(mockListing));
      mockUserModel.findById.mockReturnValue(chainable(null));

      await expect(service.getListingSeo(listingId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSellerSeo', () => {
    beforeEach(() => {
      mockUserModel.findById.mockReturnValue(chainable(mockSeller));
      mockListingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });
    });

    it('should return seller SEO data with correct title template', async () => {
      const result = await service.getSellerSeo(sellerId.toString());

      expect(result.title).toBe('Ali Khan - Seller Profile | marketplace.pk');
      expect(result.description).toContain('Ali Khan');
      expect(result.description).toContain('Lahore');
      expect(result.description).toContain('5 active listings');
      expect(result.avatarUrl).toBe('https://cdn.marketplace.pk/avatar.jpg');
      expect(result.city).toBe('Lahore');
      expect(result.isVerified).toBe(true);
      expect(result.activeListingCount).toBe(5);
      expect(result.canonicalUrl).toBe(
        `https://marketplace.pk/seller/${sellerId.toString()}`,
      );
      expect(result.personJsonLd).toBeDefined();
      expect((result.personJsonLd as any)['@type']).toBe('Person');
    });

    it('should handle seller with no city', async () => {
      const sellerNoCity = {
        ...mockSeller,
        profile: { ...mockSeller.profile, city: '' },
      };
      mockUserModel.findById.mockReturnValue(chainable(sellerNoCity));

      const result = await service.getSellerSeo(sellerId.toString());

      expect(result.city).toBe('');
      expect(result.description).not.toContain('Based in');
    });

    it('should use singular "listing" for count of 1', async () => {
      mockListingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.getSellerSeo(sellerId.toString());

      expect(result.description).toContain('1 active listing.');
      expect(result.description).not.toContain('1 active listings');
    });

    it('should throw NotFoundException when seller not found', async () => {
      mockUserModel.findById.mockReturnValue(chainable(null));

      await expect(service.getSellerSeo(sellerId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHomeSeo', () => {
    it('should return home SEO data with static title', async () => {
      const topCategories = [
        {
          _id: new Types.ObjectId(),
          name: 'Electronics',
          slug: 'electronics',
          level: 1,
          isActive: true,
          sortOrder: 1,
        },
        {
          _id: new Types.ObjectId(),
          name: 'Vehicles',
          slug: 'vehicles',
          level: 1,
          isActive: true,
          sortOrder: 2,
        },
      ];
      mockCategoryModel.find.mockReturnValue(chainableSort(topCategories));

      const result = await service.getHomeSeo();

      expect(result.title).toBe('marketplace.pk - Buy & Sell in Pakistan');
      expect(result.description).toBeDefined();
      expect(result.featuredCategories).toEqual(['Electronics', 'Vehicles']);
      expect(result.canonicalUrl).toBe('https://marketplace.pk');
      expect(result.websiteJsonLd).toBeDefined();
      expect((result.websiteJsonLd as any)['@type']).toBe('WebSite');
      expect((result.websiteJsonLd as any).potentialAction['@type']).toBe(
        'SearchAction',
      );
    });

    it('should return empty featured categories when none exist', async () => {
      mockCategoryModel.find.mockReturnValue(chainableSort([]));

      const result = await service.getHomeSeo();

      expect(result.featuredCategories).toEqual([]);
    });
  });
});
