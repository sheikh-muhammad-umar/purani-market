import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { ListingsController } from './listings.controller';
import { OwnListingView } from './own-listing-view';
import { ListingsService } from './listings.service';
import { MediaService } from './media.service';
import { PackagesService } from '../packages/packages.service';
import {
  ListingCondition,
  ListingStatus,
} from './schemas/product-listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { MediaType } from './dto/upload-media.dto';
import { AllowedStatusTransition } from './dto/update-status.dto';

describe('ListingsController', () => {
  let controller: ListingsController;
  let mockListingsService: Partial<Record<keyof ListingsService, jest.Mock>>;
  let mockMediaService: Partial<Record<keyof MediaService, jest.Mock>>;

  const listingId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    sellerId,
    title: 'Honda Civic 2020',
    description: 'Well maintained Honda Civic',
    price: { amount: 5500000, currency: 'PKR' },
    categoryId: new Types.ObjectId(),
    condition: 'used',
    status: ListingStatus.ACTIVE,
    isFeatured: false,
    viewCount: 10,
    favoriteCount: 3,
  };

  const mockPaginatedResult = {
    data: [mockListing],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  const validCreateDto: CreateListingDto = {
    title: 'Honda Civic 2020',
    description: 'Well maintained Honda Civic',
    price: { amount: 5500000 },
    categoryId: new Types.ObjectId().toString(),
    condition: ListingCondition.USED,
    images: [
      { url: 'https://example.com/img1.jpg' },
      { url: 'https://example.com/img2.jpg' },
    ],
    contactInfo: { phone: '+923001234567' },
    location: { city: 'Lahore' },
  };

  beforeEach(async () => {
    mockListingsService = {
      findAll: jest.fn().mockResolvedValue(mockPaginatedResult),
      findById: jest.fn().mockResolvedValue(mockListing),
      findByIdAndIncrementViews: jest
        .fn()
        .mockResolvedValue({ ...mockListing, viewCount: 11 }),
      create: jest.fn().mockResolvedValue(mockListing),
      update: jest.fn().mockResolvedValue({ ...mockListing, title: 'Updated' }),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockListing, status: ListingStatus.SOLD }),
      softDelete: jest
        .fn()
        .mockResolvedValue({ ...mockListing, status: ListingStatus.DELETED }),
    };

    mockMediaService = {
      uploadMedia: jest.fn().mockResolvedValue({
        url: 'https://storage.example.com/file.jpg',
        thumbnailUrl: 'https://storage.example.com/thumb.jpg',
        type: MediaType.IMAGE,
        sortOrder: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        { provide: ListingsService, useValue: mockListingsService },
        { provide: MediaService, useValue: mockMediaService },
        { provide: PackagesService, useValue: { featureListing: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<ListingsController>(ListingsController);
  });

  describe('getListings', () => {
    it('should return paginated listings with default params', async () => {
      const result = await controller.getListings();
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        1,
        20,
        'createdAt',
        'desc',
        undefined,
        {
          categoryId: undefined,
          provinceId: undefined,
          cityId: undefined,
          areaId: undefined,
          province: undefined,
          city: undefined,
          area: undefined,
          // Unset or unknown resolves to "all" rather than reaching the query.
          ownView: OwnListingView.ALL,
        },
        false,
      );
      expect(result).toBe(mockPaginatedResult);
    });

    it('should pass query params to service', async () => {
      await controller.getListings('2', '10', 'price', 'asc');
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        2,
        10,
        'price',
        'asc',
        undefined,
        {
          categoryId: undefined,
          provinceId: undefined,
          cityId: undefined,
          areaId: undefined,
          province: undefined,
          city: undefined,
          area: undefined,
          // Unset or unknown resolves to "all" rather than reaching the query.
          ownView: OwnListingView.ALL,
        },
        false,
      );
    });

    /**
     * The sellerId query parameter used to be ignored, so a seller profile asked
     * for one seller's listings and got an unfiltered list of everyone's.
     */
    it('should filter by the requested sellerId', async () => {
      await controller.getListings(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'seller-123',
      );
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        1,
        20,
        'createdAt',
        'desc',
        'seller-123',
        expect.anything(),
        // A public request never unlocks non-active listings.
        false,
      );
    });

    it('should use the signed-in user and reveal all statuses for mine=true', async () => {
      await controller.getListings(
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'me-1',
      );
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        1,
        20,
        'createdAt',
        'desc',
        'me-1',
        expect.anything(),
        true,
      );
    });

    /** A conflicting sellerId must not let mine=true read another account. */
    it('should ignore sellerId when mine=true', async () => {
      await controller.getListings(
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        'someone-else',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'me-1',
      );
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        1,
        20,
        'createdAt',
        'desc',
        'me-1',
        expect.anything(),
        true,
      );
    });

    it('should not treat mine=true as ownership without a signed-in user', async () => {
      await controller.getListings(
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
      );
      expect(mockListingsService.findAll).toHaveBeenCalledWith(
        1,
        20,
        'createdAt',
        'desc',
        undefined,
        expect.anything(),
        false,
      );
    });
  });

  describe('getListingById', () => {
    it('should return a listing and increment views', async () => {
      const mockReq = { headers: {}, ip: '127.0.0.1' };
      const listingWithToJSON = {
        ...mockListing,
        viewCount: 11,
        toJSON: () => ({ ...mockListing, viewCount: 11 }),
      };
      mockListingsService.findByIdAndIncrementViews!.mockResolvedValue(
        listingWithToJSON,
      );
      mockListingsService.getSellerVerification = jest.fn().mockResolvedValue({
        emailVerified: true,
        phoneVerified: true,
        idVerified: false,
        activeAdsCount: 5,
        responseRate: 80,
        avgResponseTime: '15 min',
      });
      const result = await controller.getListingById(
        listingId.toString(),
        mockReq,
      );
      expect(
        mockListingsService.findByIdAndIncrementViews,
      ).toHaveBeenCalledWith(
        listingId.toString(),
        undefined,
        undefined,
        mockReq,
      );
      expect(result.viewCount).toBe(11);
      // Seller verification status is a public trust signal, so anonymous users
      // receive the per-channel flags (mirroring the public `sellerVerified`
      // seal). They stay consistent with the badges shown in the UI.
      expect((result as any).sellerEmailVerified).toBe(true);
      expect((result as any).sellerPhoneVerified).toBe(true);
      expect((result as any).sellerIdVerified).toBe(false);
      // But private operational stats remain authenticated-only.
      expect((result as any).sellerActiveAdsCount).toBeUndefined();
      expect((result as any).sellerResponseRate).toBeUndefined();
    });

    it('should propagate NotFoundException from service', async () => {
      mockListingsService.findByIdAndIncrementViews!.mockRejectedValue(
        new NotFoundException('Listing not found'),
      );
      const mockReq = { headers: {}, ip: '127.0.0.1' };
      await expect(
        controller.getListingById(new Types.ObjectId().toString(), mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createListing', () => {
    it('should create a listing and return it', async () => {
      const result = await controller.createListing(
        sellerId.toString(),
        validCreateDto,
      );
      expect(mockListingsService.create).toHaveBeenCalledWith(
        sellerId.toString(),
        validCreateDto,
      );
      expect(result).toBe(mockListing);
    });

    it('should propagate ForbiddenException when listing limit reached', async () => {
      mockListingsService.create!.mockRejectedValue(
        new ForbiddenException('Listing limit reached'),
      );
      await expect(
        controller.createListing(sellerId.toString(), validCreateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateListing', () => {
    it('should update listing fields', async () => {
      const result = await controller.updateListing(
        listingId.toString(),
        sellerId.toString(),
        { title: 'Updated' },
      );
      expect(mockListingsService.update).toHaveBeenCalledWith(
        listingId.toString(),
        sellerId.toString(),
        { title: 'Updated' },
      );
      expect(result.title).toBe('Updated');
    });

    it('should propagate ForbiddenException for non-owner', async () => {
      mockListingsService.update!.mockRejectedValue(
        new ForbiddenException('You are not authorized to modify this listing'),
      );
      await expect(
        controller.updateListing(listingId.toString(), otherUserId.toString(), {
          title: 'Hack',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateListingStatus', () => {
    it('should update listing status to sold', async () => {
      const result = await controller.updateListingStatus(
        listingId.toString(),
        sellerId.toString(),
        { status: AllowedStatusTransition.SOLD },
      );
      expect(mockListingsService.updateStatus).toHaveBeenCalledWith(
        listingId.toString(),
        sellerId.toString(),
        AllowedStatusTransition.SOLD,
      );
      expect(result.status).toBe(ListingStatus.SOLD);
    });

    it('should propagate ForbiddenException for non-owner', async () => {
      mockListingsService.updateStatus!.mockRejectedValue(
        new ForbiddenException('You are not authorized to modify this listing'),
      );
      await expect(
        controller.updateListingStatus(
          listingId.toString(),
          otherUserId.toString(),
          { status: AllowedStatusTransition.SOLD },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteListing', () => {
    it('should soft-delete listing for the owner', async () => {
      const result = await controller.deleteListing(
        listingId.toString(),
        sellerId.toString(),
        'seller',
      );
      expect(mockListingsService.softDelete).toHaveBeenCalledWith(
        listingId.toString(),
        sellerId.toString(),
        'seller',
        undefined,
      );
      expect(result.status).toBe(ListingStatus.DELETED);
    });

    it('should allow admin to delete any listing', async () => {
      await controller.deleteListing(
        listingId.toString(),
        otherUserId.toString(),
        'admin',
      );
      expect(mockListingsService.softDelete).toHaveBeenCalledWith(
        listingId.toString(),
        otherUserId.toString(),
        'admin',
        undefined,
      );
    });

    it('should propagate ForbiddenException for non-owner non-admin', async () => {
      mockListingsService.softDelete!.mockRejectedValue(
        new ForbiddenException('You are not authorized to delete this listing'),
      );
      await expect(
        controller.deleteListing(
          listingId.toString(),
          otherUserId.toString(),
          'seller',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
