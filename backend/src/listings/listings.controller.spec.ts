import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { MediaService } from './media.service';
import { PackagesService } from '../packages/packages.service';
import { ListingCondition, ListingStatus } from './schemas/product-listing.schema';
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
    location: { coordinates: [74.3587, 31.5204], city: 'Lahore' },
    contactInfo: { phone: '+923001234567' },
  };

  beforeEach(async () => {
    mockListingsService = {
      findAll: jest.fn().mockResolvedValue(mockPaginatedResult),
      findById: jest.fn().mockResolvedValue(mockListing),
      findByIdAndIncrementViews: jest.fn().mockResolvedValue({ ...mockListing, viewCount: 11 }),
      create: jest.fn().mockResolvedValue(mockListing),
      update: jest.fn().mockResolvedValue({ ...mockListing, title: 'Updated' }),
      updateStatus: jest.fn().mockResolvedValue({ ...mockListing, status: ListingStatus.SOLD }),
      softDelete: jest.fn().mockResolvedValue({ ...mockListing, status: ListingStatus.DELETED }),
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
      expect(mockListingsService.findAll).toHaveBeenCalledWith(1, 20, 'createdAt', 'desc');
      expect(result).toBe(mockPaginatedResult);
    });

    it('should pass query params to service', async () => {
      await controller.getListings('2', '10', 'price', 'asc');
      expect(mockListingsService.findAll).toHaveBeenCalledWith(2, 10, 'price', 'asc');
    });
  });

  describe('getListingById', () => {
    it('should return a listing and increment views', async () => {
      const result = await controller.getListingById(listingId.toString());
      expect(mockListingsService.findByIdAndIncrementViews).toHaveBeenCalledWith(listingId.toString());
      expect(result.viewCount).toBe(11);
    });

    it('should propagate NotFoundException from service', async () => {
      mockListingsService.findByIdAndIncrementViews!.mockRejectedValue(
        new NotFoundException('Listing not found'),
      );
      await expect(
        controller.getListingById(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createListing', () => {
    it('should create a listing and return it', async () => {
      const result = await controller.createListing(sellerId.toString(), validCreateDto);
      expect(mockListingsService.create).toHaveBeenCalledWith(sellerId.toString(), validCreateDto);
      expect(result).toBe(mockListing);
    });

    it('should propagate ForbiddenException when ad limit reached', async () => {
      mockListingsService.create!.mockRejectedValue(
        new ForbiddenException('Ad limit reached'),
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
        controller.updateListing(listingId.toString(), otherUserId.toString(), { title: 'Hack' }),
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
      );
    });

    it('should propagate ForbiddenException for non-owner non-admin', async () => {
      mockListingsService.softDelete!.mockRejectedValue(
        new ForbiddenException('You are not authorized to delete this listing'),
      );
      await expect(
        controller.deleteListing(listingId.toString(), otherUserId.toString(), 'seller'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
