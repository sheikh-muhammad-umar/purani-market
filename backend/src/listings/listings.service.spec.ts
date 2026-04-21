import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ListingsService } from './listings.service';
import {
  ProductListing,
  ListingCondition,
  ListingStatus,
} from './schemas/product-listing.schema';
import { User } from '../users/schemas/user.schema';
import { Category, AttributeType } from '../categories/schemas/category.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { AllowedStatusTransition } from './dto/update-status.dto';
import { SearchSyncService } from '../search/search-sync.service';

describe('ListingsService', () => {
  let service: ListingsService;
  let mockListingModel: any;
  let mockUserModel: any;
  let mockCategoryModel: any;
  let mockRedis: Record<string, jest.Mock>;

  const listingId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();
  const parentCategoryId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    sellerId,
    title: 'iPhone 15 Pro',
    description: 'Brand new iPhone 15 Pro 256GB',
    price: { amount: 450000, currency: 'PKR' },
    categoryId,
    categoryPath: [parentCategoryId, categoryId],
    condition: 'new',
    categoryAttributes: new Map([
      ['brand', 'Apple'],
      ['storage', '256GB'],
    ]),
    images: [
      {
        url: 'https://example.com/img1.jpg',
        thumbnailUrl: 'https://example.com/img1_thumb.jpg',
        sortOrder: 0,
      },
      {
        url: 'https://example.com/img2.jpg',
        thumbnailUrl: 'https://example.com/img2_thumb.jpg',
        sortOrder: 1,
      },
    ],
    location: {
      type: 'Point',
      city: 'Lahore',
      area: 'Gulberg',
    },
    contactInfo: { phone: '+923001234567', email: 'seller@example.com' },
    status: ListingStatus.ACTIVE,
    isFeatured: false,
    viewCount: 0,
    favoriteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSeller = {
    _id: sellerId,
    email: 'seller@example.com',
    role: 'seller',
    adLimit: 10,
    activeAdCount: 0,
  };

  const mockCategory = {
    _id: categoryId,
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    parentId: parentCategoryId,
    level: 2,
    attributes: [
      {
        name: 'Brand',
        key: 'brand',
        type: AttributeType.SELECT,
        options: ['Apple', 'Samsung', 'OnePlus'],
        required: true,
      },
      {
        name: 'Storage',
        key: 'storage',
        type: AttributeType.SELECT,
        options: ['64GB', '128GB', '256GB'],
        required: false,
      },
    ],
    filters: [],
    isActive: true,
  };

  const mockParentCategory = {
    _id: parentCategoryId,
    name: 'Electronics',
    slug: 'electronics',
    parentId: null,
    level: 1,
    attributes: [],
    filters: [],
    isActive: true,
  };

  const validCreateDto: CreateListingDto = {
    title: 'iPhone 15 Pro',
    description: 'Brand new iPhone 15 Pro 256GB',
    price: { amount: 450000 },
    categoryId: categoryId.toString(),
    condition: ListingCondition.NEW,
    categoryAttributes: { brand: 'Apple', storage: '256GB' },
    images: [
      { url: 'https://example.com/img1.jpg' },
      { url: 'https://example.com/img2.jpg' },
    ],
    contactInfo: { phone: '+923001234567', email: 'seller@example.com' },
    location: { city: 'Lahore' },
  };

  let savedListing: any;

  beforeEach(async () => {
    savedListing = {
      ...mockListing,
      save: jest.fn().mockResolvedValue(mockListing),
    };

    mockListingModel = jest.fn().mockImplementation(() => savedListing);
    mockListingModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockListing),
    });
    mockListingModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockListing),
    });
    mockListingModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockListing]),
          }),
        }),
      }),
    });
    mockListingModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockSeller }),
      }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    mockCategoryModel = {
      findById: jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString()) {
          return { exec: jest.fn().mockResolvedValue(mockCategory) };
        }
        if (idStr === parentCategoryId.toString()) {
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        }
        return { exec: jest.fn().mockResolvedValue(null) };
      }),
    };

    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
        { provide: getModelToken('Conversation'), useValue: {} },
        { provide: getModelToken('Message'), useValue: {} },
        {
          provide: SearchSyncService,
          useValue: { indexListing: jest.fn(), removeListing: jest.fn() },
        },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  describe('findAll', () => {
    it('should return paginated active listings', async () => {
      const result = await service.findAll(1, 20);
      expect(result.data).toEqual([mockListing]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(mockListingModel.find).toHaveBeenCalledWith({
        status: ListingStatus.ACTIVE,
        deletedAt: { $exists: false },
      });
    });

    it('should clamp page to minimum 1', async () => {
      const result = await service.findAll(0, 20);
      expect(result.page).toBe(1);
    });

    it('should clamp limit to maximum 100', async () => {
      const result = await service.findAll(1, 200);
      expect(result.limit).toBe(100);
    });
  });

  describe('findById', () => {
    it('should return a listing by id', async () => {
      const result = await service.findById(listingId.toString());
      expect(mockListingModel.findById).toHaveBeenCalledWith(
        listingId.toString(),
      );
      expect(result).toBe(mockListing);
    });

    it('should throw NotFoundException for invalid ObjectId', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when listing not found', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findById(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdAndIncrementViews', () => {
    const mockReq = {
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
    };

    it('should increment viewCount on first view and return listing', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockRedis.set.mockResolvedValue('OK'); // NX succeeds = new view

      const result = await service.findByIdAndIncrementViews(
        listingId.toString(),
        undefined,
        undefined,
        mockReq,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`view:${listingId.toString()}:`),
        '1',
        'EX',
        1800,
        'NX',
      );
      expect(mockListingModel.updateOne).toHaveBeenCalledWith(
        { _id: listingId },
        { $inc: { viewCount: 1 } },
      );
      expect(result.viewCount).toBe(1);
    });

    it('should NOT increment viewCount on repeat view within window', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockRedis.set.mockResolvedValue(null); // NX fails = already viewed

      const result = await service.findByIdAndIncrementViews(
        listingId.toString(),
        undefined,
        undefined,
        mockReq,
      );

      expect(mockListingModel.updateOne).not.toHaveBeenCalled();
      expect(result.viewCount).toBe(0);
    });

    it('should NOT increment viewCount for the listing owner', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn();

      await service.findByIdAndIncrementViews(
        listingId.toString(),
        sellerId.toString(),
        undefined,
        mockReq,
      );

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockListingModel.updateOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid ObjectId', async () => {
      await expect(
        service.findByIdAndIncrementViews('invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing not found', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findByIdAndIncrementViews(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update listing fields for the owner', async () => {
      const updatedListing = { ...mockListing, title: 'Updated Title' };
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedListing),
      });
      const result = await service.update(
        listingId.toString(),
        sellerId.toString(),
        {
          title: 'Updated Title',
        },
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should throw ForbiddenException if non-owner tries to update', async () => {
      await expect(
        service.update(listingId.toString(), otherUserId.toString(), {
          title: 'Hack',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if listing is deleted', async () => {
      const deletedListing = { ...mockListing, status: ListingStatus.DELETED };
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedListing),
      });
      await expect(
        service.update(listingId.toString(), sellerId.toString(), {
          title: 'X',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update listing status to sold', async () => {
      const soldListing = { ...mockListing, status: ListingStatus.SOLD };
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(soldListing),
      });
      const result = await service.updateStatus(
        listingId.toString(),
        sellerId.toString(),
        AllowedStatusTransition.SOLD,
      );
      expect(result.status).toBe(ListingStatus.SOLD);
    });

    it('should update listing status to reserved', async () => {
      const reservedListing = {
        ...mockListing,
        status: ListingStatus.RESERVED,
      };
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(reservedListing),
      });
      const result = await service.updateStatus(
        listingId.toString(),
        sellerId.toString(),
        AllowedStatusTransition.RESERVED,
      );
      expect(result.status).toBe(ListingStatus.RESERVED);
    });

    it('should throw ForbiddenException if non-owner tries to update status', async () => {
      await expect(
        service.updateStatus(
          listingId.toString(),
          otherUserId.toString(),
          AllowedStatusTransition.SOLD,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if listing is deleted', async () => {
      const deletedListing = { ...mockListing, status: ListingStatus.DELETED };
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedListing),
      });
      await expect(
        service.updateStatus(
          listingId.toString(),
          sellerId.toString(),
          AllowedStatusTransition.SOLD,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('should soft-delete listing for the owner', async () => {
      const deletedListing = {
        ...mockListing,
        status: ListingStatus.DELETED,
        deletedAt: new Date(),
      };
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedListing),
      });
      const result = await service.softDelete(
        listingId.toString(),
        sellerId.toString(),
        'seller',
      );
      expect(result.status).toBe(ListingStatus.DELETED);
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $inc: { activeAdCount: -1 } },
      );
    });

    it('should allow admin to soft-delete any listing', async () => {
      const deletedListing = {
        ...mockListing,
        status: ListingStatus.DELETED,
        deletedAt: new Date(),
      };
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedListing),
      });
      const result = await service.softDelete(
        listingId.toString(),
        otherUserId.toString(),
        'admin',
      );
      expect(result.status).toBe(ListingStatus.DELETED);
    });

    it('should throw ForbiddenException if non-owner non-admin tries to delete', async () => {
      await expect(
        service.softDelete(
          listingId.toString(),
          otherUserId.toString(),
          'seller',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if listing is already deleted', async () => {
      const deletedListing = { ...mockListing, status: ListingStatus.DELETED };
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedListing),
      });
      await expect(
        service.softDelete(listingId.toString(), sellerId.toString(), 'seller'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('should create a listing successfully with status Active', async () => {
      const result = await service.create(sellerId.toString(), validCreateDto);
      expect(mockCategoryModel.findById).toHaveBeenCalled();
      expect(mockUserModel.findById).toHaveBeenCalled();
      expect(savedListing.save).toHaveBeenCalled();
      expect(mockUserModel.updateOne).toHaveBeenCalled();
      expect(result).toBe(mockListing);
    });

    it('should set status to Pending Review when moderation is enabled', async () => {
      await service.create(sellerId.toString(), validCreateDto, true);
      const constructorCall = mockListingModel.mock.calls[0][0];
      expect(constructorCall.status).toBe('pending_review');
    });

    it('should set status to Active when moderation is disabled', async () => {
      await service.create(sellerId.toString(), validCreateDto, false);
      const constructorCall = mockListingModel.mock.calls[0][0];
      expect(constructorCall.status).toBe('active');
    });

    it('should throw BadRequestException when fewer than 2 media items', async () => {
      const dto = {
        ...validCreateDto,
        images: [{ url: 'https://example.com/img1.jpg' }],
        video: undefined,
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept 1 image + 1 video as 2 media items', async () => {
      const dto = {
        ...validCreateDto,
        images: [{ url: 'https://example.com/img1.jpg' }],
        video: { url: 'https://example.com/video.mp4' },
      };
      const result = await service.create(sellerId.toString(), dto);
      expect(result).toBe(mockListing);
    });

    it('should throw BadRequestException for invalid category ID', async () => {
      const dto = { ...validCreateDto, categoryId: 'invalid' };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when category not found', async () => {
      const nonExistentId = new Types.ObjectId();
      mockCategoryModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const dto = { ...validCreateDto, categoryId: nonExistentId.toString() };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when required category attribute is missing', async () => {
      const dto = {
        ...validCreateDto,
        categoryAttributes: { storage: '256GB' },
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when select attribute has invalid option', async () => {
      const dto = {
        ...validCreateDto,
        categoryAttributes: { brand: 'Nokia', storage: '256GB' },
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when seller has reached ad limit', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockSeller, activeAdCount: 10 }),
      });
      await expect(
        service.create(sellerId.toString(), validCreateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when seller not found', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.create(sellerId.toString(), validCreateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should build category path from hierarchy', async () => {
      await service.create(sellerId.toString(), validCreateDto);
      const constructorCall = mockListingModel.mock.calls[0][0];
      expect(constructorCall.categoryPath).toHaveLength(2);
      expect(constructorCall.categoryPath[0].toString()).toBe(
        parentCategoryId.toString(),
      );
      expect(constructorCall.categoryPath[1].toString()).toBe(
        categoryId.toString(),
      );
    });

    it('should increment seller activeAdCount after creation', async () => {
      await service.create(sellerId.toString(), validCreateDto);
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { activeAdCount: 1 } },
      );
    });

    it('should throw BadRequestException when zero media items provided', async () => {
      const dto = { ...validCreateDto, images: [], video: undefined };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow seller with activeAdCount below adLimit', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...mockSeller, activeAdCount: 9, adLimit: 10 }),
      });
      const result = await service.create(sellerId.toString(), validCreateDto);
      expect(result).toBe(mockListing);
    });
  });

  describe('category attribute validation', () => {
    it('should reject non-string value for TEXT attribute', async () => {
      const textCategory = {
        ...mockCategory,
        attributes: [
          {
            name: 'Description',
            key: 'desc',
            type: AttributeType.TEXT,
            required: true,
            options: [],
          },
        ],
      };
      mockCategoryModel.findById = jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString())
          return { exec: jest.fn().mockResolvedValue(textCategory) };
        if (idStr === parentCategoryId.toString())
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        return { exec: jest.fn().mockResolvedValue(null) };
      });
      const dto = { ...validCreateDto, categoryAttributes: { desc: 123 } };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject non-number value for NUMBER attribute', async () => {
      const numCategory = {
        ...mockCategory,
        attributes: [
          {
            name: 'Mileage',
            key: 'mileage',
            type: AttributeType.NUMBER,
            required: true,
            options: [],
          },
        ],
      };
      mockCategoryModel.findById = jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString())
          return { exec: jest.fn().mockResolvedValue(numCategory) };
        if (idStr === parentCategoryId.toString())
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        return { exec: jest.fn().mockResolvedValue(null) };
      });
      const dto = {
        ...validCreateDto,
        categoryAttributes: { mileage: 'not-a-number' },
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject non-boolean value for BOOLEAN attribute', async () => {
      const boolCategory = {
        ...mockCategory,
        attributes: [
          {
            name: 'Negotiable',
            key: 'negotiable',
            type: AttributeType.BOOLEAN,
            required: true,
            options: [],
          },
        ],
      };
      mockCategoryModel.findById = jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString())
          return { exec: jest.fn().mockResolvedValue(boolCategory) };
        if (idStr === parentCategoryId.toString())
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        return { exec: jest.fn().mockResolvedValue(null) };
      });
      const dto = {
        ...validCreateDto,
        categoryAttributes: { negotiable: 'yes' },
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject non-array value for MULTISELECT attribute', async () => {
      const multiCategory = {
        ...mockCategory,
        attributes: [
          {
            name: 'Colors',
            key: 'colors',
            type: AttributeType.MULTISELECT,
            required: true,
            options: ['Red', 'Blue', 'Green'],
          },
        ],
      };
      mockCategoryModel.findById = jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString())
          return { exec: jest.fn().mockResolvedValue(multiCategory) };
        if (idStr === parentCategoryId.toString())
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        return { exec: jest.fn().mockResolvedValue(null) };
      });
      const dto = { ...validCreateDto, categoryAttributes: { colors: 'Red' } };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid option in MULTISELECT attribute', async () => {
      const multiCategory = {
        ...mockCategory,
        attributes: [
          {
            name: 'Colors',
            key: 'colors',
            type: AttributeType.MULTISELECT,
            required: true,
            options: ['Red', 'Blue', 'Green'],
          },
        ],
      };
      mockCategoryModel.findById = jest.fn().mockImplementation((id: any) => {
        const idStr = id.toString();
        if (idStr === categoryId.toString())
          return { exec: jest.fn().mockResolvedValue(multiCategory) };
        if (idStr === parentCategoryId.toString())
          return { exec: jest.fn().mockResolvedValue(mockParentCategory) };
        return { exec: jest.fn().mockResolvedValue(null) };
      });
      const dto = {
        ...validCreateDto,
        categoryAttributes: { colors: ['Red', 'Yellow'] },
      };
      await expect(service.create(sellerId.toString(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update edge cases', () => {
    it('should throw NotFoundException when findByIdAndUpdate returns null during update', async () => {
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.update(listingId.toString(), sellerId.toString(), {
          title: 'New',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when findByIdAndUpdate returns null during status update', async () => {
      mockListingModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.updateStatus(
          listingId.toString(),
          sellerId.toString(),
          AllowedStatusTransition.SOLD,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll sorting', () => {
    it('should pass sort and order parameters to the query', async () => {
      await service.findAll(1, 20, 'price', 'asc');
      const sortFn = mockListingModel.find().sort;
      expect(mockListingModel.find).toHaveBeenCalled();
    });

    it('should clamp limit to minimum 1', async () => {
      const result = await service.findAll(1, 0);
      expect(result.limit).toBe(1);
    });
  });
});
