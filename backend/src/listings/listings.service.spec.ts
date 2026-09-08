import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ViewCounterService } from '../views/view-counter.service';
import { OwnListingView } from './own-listing-view';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ListingsService, isSellerVerified } from './listings.service';
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
import { BrandsService } from '../brands/brands.service';
import { VehicleBrandService } from '../brands/vehicle-brand.service';
import { VehicleModelService } from '../brands/vehicle-model.service';
import { VehicleVariantService } from '../brands/vehicle-variant.service';
import { PackagesService } from '../packages/packages.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { ConfigService } from '@nestjs/config';

describe('ListingsService', () => {
  let service: ListingsService;
  let mockListingModel: any;
  let mockUserModel: any;
  let mockCategoryModel: any;
  let mockRedis: Record<string, jest.Mock>;
  let mockViewCounter: { shouldCountView: jest.Mock };
  let mockSearchSync: { indexListing: jest.Mock; removeListing: jest.Mock };

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
    listingLimit: 10,
    activeListingCount: 0,
    phone: '+923001234567',
    phoneVerified: true,
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
      populate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      }),
      exec: jest.fn().mockResolvedValue(mockListing),
    });
    mockListingModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockListing),
    });
    mockListingModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
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
    mockListingModel.aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          all: [{ count: 9 }],
          active: [{ count: 5 }],
          rejected: [{ count: 1 }],
          // pending, inactive, expiring_soon and expired absent on purpose: a
          // facet branch that matches nothing returns no rows at all.
        },
      ]),
    });

    mockSearchSync = { indexListing: jest.fn(), removeListing: jest.fn() };
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
        let result: any = null;
        if (idStr === categoryId.toString()) {
          result = mockCategory;
        } else if (idStr === parentCategoryId.toString()) {
          result = mockParentCategory;
        }
        return {
          exec: jest.fn().mockResolvedValue(result),
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(result),
          }),
        };
      }),
    };

    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    // The window rule itself lives in ViewCounterService and is covered by its
    // own spec; here we only care that this service honours the verdict.
    mockViewCounter = {
      shouldCountView: jest.fn().mockResolvedValue(true),
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
        { provide: SearchSyncService, useValue: mockSearchSync },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
        { provide: ViewCounterService, useValue: mockViewCounter },
        {
          provide: BrandsService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: VehicleBrandService,
          useValue: {
            findById: jest.fn(),
            countByCategory: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: VehicleModelService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: VehicleVariantService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: PackagesService,
          useValue: {
            applyPackageToListing: jest.fn(),
            findPurchaseById: jest.fn(),
          },
        },
        {
          provide: AdminTrackerService,
          useValue: { track: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'listing.activeDays': 30,
              };
              return config[key];
            }),
          },
        },
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
      // No `deletedAt` guard on the public path: soft-delete sets status and
      // deletedAt in the same update, so ACTIVE already excludes deleted rows,
      // and the unindexed predicate downgraded the pagination count from an
      // index-only scan to fetching every match.
      expect(mockListingModel.countDocuments).toHaveBeenCalledWith({
        status: ListingStatus.ACTIVE,
      });
    });

    it('should not add an unindexed deletedAt guard when status is pinned', async () => {
      await service.findAll(1, 20);
      // The base filter is the one the pagination total is counted over, which is
      // where the cost was.
      const filter = mockListingModel.countDocuments.mock.calls[0][0];
      expect(filter.status).toBe(ListingStatus.ACTIVE);
      expect(filter.deletedAt).toBeUndefined();
      for (const call of mockListingModel.find.mock.calls) {
        expect(call[0].status).toBe(ListingStatus.ACTIVE);
        expect(call[0].deletedAt).toBeUndefined();
      }
    });

    it('should not make isFeatured the primary sort key', async () => {
      // Featured used to lead the sort, which is a gate rather than a boost: with
      // 2,428 featured listings live, the first 122 pages were entirely featured
      // and `sort=price` returned the cheapest *featured* listing, not the
      // cheapest one.
      await service.findAll(1, 20, 'price.amount', 'asc');

      const sortArg = mockListingModel.find.mock.results[0].value.sort.mock
        .calls[0][0] as Record<string, number>;
      expect(sortArg.isFeatured).toBeUndefined();
      expect(Object.keys(sortArg)[0]).toBe('price.amount');
    });

    it('should reserve bounded promoted slots on the public browse path', async () => {
      await service.findAll(1, 20);

      // Two counts: the pagination total, then how many qualify for promotion.
      const [baseFilter, featuredFilter] =
        mockListingModel.countDocuments.mock.calls.map(
          (call: any[]) => call[0],
        );
      expect(baseFilter.isFeatured).toBeUndefined();
      expect(featuredFilter.isFeatured).toBe(true);
      // A lapsed paid window cannot hold a slot on a stale flag alone.
      expect(featuredFilter.featuredUntil.$gt).toBeInstanceOf(Date);
    });

    it('should skip promotion for seller-scoped queries', async () => {
      // A seller reading their own listings, or a visitor on a seller profile,
      // wants that catalogue in the order asked for — not three of the same
      // seller's ads pinned above it.
      await service.findAll(1, 20, 'createdAt', 'desc', sellerId.toString());

      expect(mockListingModel.countDocuments).toHaveBeenCalledTimes(1);
      expect(mockListingModel.find).toHaveBeenCalledTimes(1);
      expect(mockListingModel.find.mock.calls[0][0].isFeatured).toBeUndefined();
    });

    it('should clamp page to minimum 1', async () => {
      const result = await service.findAll(0, 20);
      expect(result.page).toBe(1);
    });

    it('should clamp limit to maximum 100', async () => {
      const result = await service.findAll(1, 200);
      expect(result.limit).toBe(100);
    });

    /**
     * A public seller profile. Naming a seller used to drop the status filter,
     * which would have shown that seller's drafts, listings awaiting moderation
     * and rejected ones to anyone who opened their profile.
     */
    it('should filter to one seller and still show only active listings', async () => {
      await service.findAll(1, 20, 'createdAt', 'desc', sellerId.toString());
      expect(mockListingModel.find).toHaveBeenCalledWith({
        sellerId: expect.anything(),
        status: ListingStatus.ACTIVE,
      });
    });

    /** The owner's own list, which is the only case that reveals other statuses. */
    it('should drop the status filter only when all statuses are requested', async () => {
      await service.findAll(
        1,
        20,
        'createdAt',
        'desc',
        sellerId.toString(),
        undefined,
        true,
      );
      const filter = mockListingModel.find.mock.calls.at(-1)?.[0];
      // The guard is REQUIRED here and must not be removed as a performance
      // tidy-up: with no status pinned, dropping it would list the owner's
      // soft-deleted listings back to them.
      expect(filter).toMatchObject({ deletedAt: { $exists: false } });
      expect(filter.sellerId).toBeDefined();
      expect(filter.status).toBeUndefined();
    });

    /**
     * The owner "all" view pins no status (ownViewConditions(ALL) returns {}), so
     * it is the specific case that still depends on the deletedAt guard.
     */
    it('should keep the deletedAt guard for the owner all-statuses view', async () => {
      await service.findAll(
        1,
        20,
        'createdAt',
        'desc',
        sellerId.toString(),
        { ownView: OwnListingView.ALL },
        true,
      );
      const filter = mockListingModel.find.mock.calls.at(-1)?.[0];
      expect(filter.deletedAt).toEqual({ $exists: false });
      expect(filter.status).toBeUndefined();
    });

    it('should reject a malformed sellerId rather than throwing a cast error', async () => {
      await expect(
        service.findAll(1, 20, 'createdAt', 'desc', 'not-an-object-id'),
      ).rejects.toThrow(BadRequestException);
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
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockListing }),
        }),
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockViewCounter.shouldCountView.mockResolvedValue(true);

      const result = await service.findByIdAndIncrementViews(
        listingId.toString(),
        undefined,
        undefined,
        mockReq,
      );

      expect(mockViewCounter.shouldCountView).toHaveBeenCalledWith(
        'listing',
        listingId.toString(),
        { userId: undefined, req: mockReq },
      );
      expect(mockListingModel.updateOne).toHaveBeenCalledWith(
        { _id: listingId },
        { $inc: { viewCount: 1 } },
      );
      expect(result.viewCount).toBe(1);
    });

    it('should NOT increment viewCount on repeat view within the hour', async () => {
      mockListingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockListing }),
        }),
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });
      mockViewCounter.shouldCountView.mockResolvedValue(false);

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
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockListing }),
        }),
        exec: jest.fn().mockResolvedValue({ ...mockListing }),
      });
      mockListingModel.updateOne = jest.fn();

      await service.findByIdAndIncrementViews(
        listingId.toString(),
        sellerId.toString(),
        undefined,
        mockReq,
      );

      // Not even asked: the owner is excluded before the window is consulted, so
      // a seller checking their own ad does not burn their hour.
      expect(mockViewCounter.shouldCountView).not.toHaveBeenCalled();
      expect(mockListingModel.updateOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid ObjectId', async () => {
      await expect(
        service.findByIdAndIncrementViews('invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing not found', async () => {
      mockListingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
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
        { $inc: { activeListingCount: -1 } },
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

    it('should throw ForbiddenException when seller has reached listing limit', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...mockSeller, activeListingCount: 10 }),
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

    it('should increment seller activeListingCount after creation', async () => {
      await service.create(sellerId.toString(), validCreateDto);
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { activeListingCount: 1 } },
      );
    });

    it('should allow seller with activeListingCount below listingLimit', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockSeller,
          activeListingCount: 9,
          listingLimit: 10,
        }),
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
  describe('isSellerVerified', () => {
    it('should require all three checks', () => {
      expect(
        isSellerVerified({
          emailVerified: true,
          phoneVerified: true,
          idVerified: true,
        }),
      ).toBe(true);
      // Email and phone alone are not enough — the badge claims ID too.
      expect(
        isSellerVerified({
          emailVerified: true,
          phoneVerified: true,
          idVerified: false,
        }),
      ).toBe(false);
      expect(isSellerVerified(null)).toBe(false);
      expect(isSellerVerified(undefined)).toBe(false);
      expect(isSellerVerified({})).toBe(false);
    });
  });

  describe('syncSellerVerified', () => {
    /**
     * Guards the reported bug: `sellerVerified` is denormalised onto each listing
     * and used to be written only at creation, so withdrawing a seller's ID
     * verification left every listing still showing "Verified seller".
     */
    it('should clear the badge and re-index when the seller is no longer verified', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              emailVerified: true,
              phoneVerified: true,
              idVerified: false,
            }),
          }),
        }),
      });
      const stale = [
        { _id: listingId, sellerId, sellerVerified: true },
        { _id: new Types.ObjectId(), sellerId, sellerVerified: true },
      ];
      mockListingModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(stale),
      });
      mockListingModel.updateMany = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      });

      const changed = await service.syncSellerVerified(sellerId.toString());

      expect(changed).toBe(2);
      expect(mockListingModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ sellerVerified: { $ne: false } }),
        { $set: { sellerVerified: false } },
      );
      // Each changed listing has to reach Elasticsearch, which serves the cards
      // that render the badge.
      expect(mockSearchSync.indexListing).toHaveBeenCalledTimes(2);
      expect(stale.every((l) => l.sellerVerified === false)).toBe(true);
    });

    it('should grant the badge once the seller becomes fully verified', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              emailVerified: true,
              phoneVerified: true,
              idVerified: true,
            }),
          }),
        }),
      });
      mockListingModel.find = jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: listingId, sellerId, sellerVerified: false },
          ]),
      });
      mockListingModel.updateMany = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      const changed = await service.syncSellerVerified(sellerId.toString());

      expect(changed).toBe(1);
      expect(mockListingModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ sellerVerified: { $ne: true } }),
        { $set: { sellerVerified: true } },
      );
    });

    it('should do nothing when the badges already match', async () => {
      mockUserModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              emailVerified: true,
              phoneVerified: true,
              idVerified: true,
            }),
          }),
        }),
      });
      mockListingModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      mockListingModel.updateMany = jest.fn();

      const changed = await service.syncSellerVerified(sellerId.toString());

      expect(changed).toBe(0);
      expect(mockListingModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('own listing views', () => {
    const sellerObjectId = sellerId;

    it('applies the requested view for an owner', async () => {
      await service.findAll(
        1,
        20,
        'createdAt',
        'desc',
        sellerObjectId.toString(),
        { ownView: OwnListingView.REJECTED },
        true,
      );

      const filter = mockListingModel.find.mock.calls[0][0];
      expect(filter.status).toBe(ListingStatus.REJECTED);
      expect(filter.sellerId).toEqual(sellerObjectId);
    });

    it('ignores the view on a public request', async () => {
      await service.findAll(
        1,
        20,
        'createdAt',
        'desc',
        sellerObjectId.toString(),
        { ownView: OwnListingView.REJECTED },
        false,
      );

      // A public seller profile passes a sellerId but never includeAllStatuses;
      // honouring the view here would have exposed rejected listings to anyone
      // who guessed the parameter.
      const filter = mockListingModel.find.mock.calls[0][0];
      expect(filter.status).toBe(ListingStatus.ACTIVE);
    });

    it('reports zero for views that matched nothing', async () => {
      const counts = await service.getOwnViewCounts(sellerObjectId.toString());

      expect(counts).toEqual({
        all: 9,
        active: 5,
        pending: 0,
        rejected: 1,
        inactive: 0,
        expiring_soon: 0,
        expired: 0,
      });
    });

    it("counts only the seller's own live listings", async () => {
      await service.getOwnViewCounts(sellerObjectId.toString());

      const [pipeline] = mockListingModel.aggregate.mock.calls[0];
      expect(pipeline[0].$match).toEqual({
        sellerId: sellerObjectId,
        deletedAt: { $exists: false },
      });
      // One aggregation for all seven, rather than seven round trips.
      expect(Object.keys(pipeline[1].$facet)).toHaveLength(7);
    });

    it('rejects a malformed seller id rather than throwing a cast error', async () => {
      await expect(service.getOwnViewCounts('not-an-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('query parameter hardening', () => {
    /** The shape the extended query parser produces for ?x[$ne]=y. */
    const injected = { $ne: null } as unknown as string;

    it('does not let an injected operator reach the filter', async () => {
      await service.findAll(1, 20, 'createdAt', 'desc', undefined, {
        city: injected,
        province: injected,
      });

      const filter = mockListingModel.find.mock.calls[0][0];
      // Coerced away entirely rather than applied: an absent filter is safe,
      // a `{ $ne: null }` one matches everything.
      expect(filter['location.city']).toBeUndefined();
      expect(filter['location.province']).toBeUndefined();
    });

    it('rejects a category id that is not an ObjectId', async () => {
      // categoryPath holds ObjectIds, so a raw string could never match — it was
      // only ever a route for client-controlled values into the query.
      await expect(
        service.findAll(1, 20, 'createdAt', 'desc', undefined, {
          categoryId: 'not-an-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an injected object where a location id belongs', async () => {
      await expect(
        service.findAll(1, 20, 'createdAt', 'desc', undefined, {
          provinceId: 'nope',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ignores a sort field that is not on the allow-list', async () => {
      await service.findAll(1, 20, 'contactInfo.phone', 'desc');

      const sortArg = mockListingModel.find.mock.results[0].value.sort.mock
        .calls[0][0] as Record<string, number>;
      // Falls back rather than ordering by a hidden field, which would leak its
      // ordering even though the projection strips it.
      expect(sortArg['contactInfo.phone']).toBeUndefined();
      expect(sortArg.createdAt).toBe(-1);
    });

    it('accepts an allowed sort field', async () => {
      await service.findAll(1, 20, 'price.amount', 'asc');

      const sortArg = mockListingModel.find.mock.results[0].value.sort.mock
        .calls[0][0] as Record<string, number>;
      expect(sortArg['price.amount']).toBe(1);
    });

    it('caps the page size and floors the page', async () => {
      const result = await service.findAll(0, 100000);

      expect(result.limit).toBe(100);
      expect(result.page).toBe(1);
    });

    it('treats a non-numeric page size as the default', async () => {
      // `parseInt('abc')` used to become NaN and propagate into skip/limit.
      const result = await service.findAll(
        'abc' as unknown as number,
        'abc' as unknown as number,
      );

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
