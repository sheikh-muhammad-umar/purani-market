import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesService } from './packages.service';
import { AdPackage, AdPackageType } from './schemas/ad-package.schema';
import {
  PackagePurchase,
  PaymentMethod,
  PaymentStatus,
} from './schemas/package-purchase.schema';
import { User } from '../users/schemas/user.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { PaymentsService } from '../payments/payments.service';

describe('PackagesService', () => {
  let service: PackagesService;

  const packageId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const purchaseId = new Types.ObjectId();

  const mockPackage = {
    _id: packageId,
    name: '5 Featured Ads - 7 Days',
    type: AdPackageType.FEATURED_ADS,
    duration: 7,
    quantity: 5,
    defaultPrice: 500,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdSlotsPackage = {
    _id: new Types.ObjectId(),
    name: '10 Ad Slots - 30 Days',
    type: AdPackageType.AD_SLOTS,
    duration: 30,
    quantity: 10,
    defaultPrice: 1000,
    categoryPricing: [],
    isActive: true,
  };

  const mockPackages = [mockPackage, mockAdSlotsPackage];

  let mockAdPackageModel: any;
  let mockPackagePurchaseModel: any;
  let mockUserModel: any;
  let mockListingModel: any;
  let mockPaymentsService: any;

  beforeEach(async () => {
    mockAdPackageModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPackages),
        }),
      }),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPackage),
      }),
    };

    const mockCreatedPackage = {
      ...mockPackage,
      save: jest.fn().mockResolvedValue(mockPackage),
    };
    mockAdPackageModel.constructor = jest.fn().mockImplementation(() => mockCreatedPackage);
    // For createPackage - the service uses `new this.adPackageModel(...)` which is the model itself as constructor
    // We need to make the model callable as a constructor
    const originalFind = mockAdPackageModel.find;
    const originalFindById = mockAdPackageModel.findById;
    const constructorFn: any = jest.fn().mockImplementation(() => mockCreatedPackage);
    constructorFn.find = originalFind;
    constructorFn.findById = originalFindById;
    mockAdPackageModel = constructorFn;

    const mockSavedPurchase = {
      _id: purchaseId,
      sellerId,
      packageId,
      type: AdPackageType.FEATURED_ADS,
      quantity: 5,
      remainingQuantity: 5,
      duration: 7,
      price: 500,
      paymentMethod: PaymentMethod.JAZZCASH,
      paymentStatus: PaymentStatus.PENDING,
      save: jest.fn().mockResolvedValue({
        _id: purchaseId,
        sellerId,
        packageId,
        type: AdPackageType.FEATURED_ADS,
        quantity: 5,
        remainingQuantity: 5,
        duration: 7,
        price: 500,
        paymentMethod: PaymentMethod.JAZZCASH,
        paymentStatus: PaymentStatus.PENDING,
      }),
    };

    mockPackagePurchaseModel = jest.fn().mockImplementation(() => mockSavedPurchase);
    mockPackagePurchaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
      exec: jest.fn().mockResolvedValue([]),
    });
    mockPackagePurchaseModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPackagePurchaseModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    mockPackagePurchaseModel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeAdCount: 5,
          adLimit: 10,
        }),
      }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: listingId,
          sellerId,
          isFeatured: false,
        }),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: listingId,
          sellerId,
          isFeatured: true,
          featuredUntil: new Date(),
        }),
      }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    };

    mockPaymentsService = {
      initiatePayment: jest.fn().mockResolvedValue({
        transactionId: 'JC-123',
        redirectUrl: 'https://sandbox.jazzcash.com.pk/checkout?txn=JC-123',
        status: 'initiated',
      }),
      verifyCallback: jest.fn().mockResolvedValue({
        transactionId: 'JC-123',
        status: 'completed',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: getModelToken(AdPackage.name), useValue: mockAdPackageModel },
        { provide: getModelToken(PackagePurchase.name), useValue: mockPackagePurchaseModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(ProductListing.name), useValue: mockListingModel },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
  });

  describe('findAll', () => {
    it('should return all active packages sorted by type and duration', async () => {
      const result = await service.findAll();
      expect(result).toEqual(mockPackages);
      expect(mockAdPackageModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('findById', () => {
    it('should return a package by id', async () => {
      const result = await service.findById(packageId.toString());
      expect(result).toEqual(mockPackage);
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when package does not exist', async () => {
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findById(new Types.ObjectId().toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('purchasePackages', () => {
    it('should create purchase records and initiate payment', async () => {
      const dto = {
        items: [{ packageId: packageId.toString() }],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      const result = await service.purchasePackages(sellerId.toString(), dto);

      expect(result.redirectUrl).toContain('jazzcash');
      expect(result.transactionId).toBe('JC-123');
      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        PaymentMethod.JAZZCASH,
        expect.objectContaining({ amount: 500, currency: 'PKR' }),
      );
    });

    it('should throw BadRequestException for empty items', async () => {
      const dto = { items: [], paymentMethod: PaymentMethod.JAZZCASH };
      await expect(
        service.purchasePackages(sellerId.toString(), dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for inactive package', async () => {
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPackage, isActive: false }),
      });

      const dto = {
        items: [{ packageId: packageId.toString() }],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      await expect(
        service.purchasePackages(sellerId.toString(), dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support purchasing multiple packages simultaneously', async () => {
      const pkg2Id = new Types.ObjectId();
      let callCount = 0;
      mockAdPackageModel.findById.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(
          callCount++ === 0 ? mockPackage : { ...mockAdSlotsPackage, _id: pkg2Id },
        ),
      }));

      const dto = {
        items: [
          { packageId: packageId.toString() },
          { packageId: pkg2Id.toString() },
        ],
        paymentMethod: PaymentMethod.CARD,
      };

      const result = await service.purchasePackages(sellerId.toString(), dto);

      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        PaymentMethod.CARD,
        expect.objectContaining({ amount: 1500 }),
      );
      expect(result.transactionId).toBeDefined();
    });
  });

  describe('getMyPurchases', () => {
    it('should return seller purchases sorted by createdAt desc', async () => {
      await service.getMyPurchases(sellerId.toString());
      expect(mockPackagePurchaseModel.find).toHaveBeenCalledWith({
        sellerId: expect.any(Types.ObjectId),
      });
    });
  });

  describe('handlePaymentCallback', () => {
    it('should activate purchases on successful payment', async () => {
      const mockPurchases = [
        {
          _id: purchaseId,
          sellerId,
          type: AdPackageType.AD_SLOTS,
          quantity: 10,
          duration: 30,
        },
      ];
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPurchases),
      });

      const result = await service.handlePaymentCallback({
        transactionId: 'JC-123',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '000',
      });

      expect(result.status).toBe('success');
      expect(mockPackagePurchaseModel.updateOne).toHaveBeenCalledWith(
        { _id: purchaseId },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: PaymentStatus.COMPLETED,
          }),
        }),
      );
      // Ad slots should increase seller's ad limit
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $inc: { adLimit: 10 } },
      );
    });

    it('should fail purchases on failed payment', async () => {
      mockPaymentsService.verifyCallback.mockResolvedValue({
        transactionId: 'JC-123',
        status: 'failed',
        reason: 'Insufficient funds',
      });

      const mockPurchases = [{ _id: purchaseId, sellerId }];
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPurchases),
      });

      const result = await service.handlePaymentCallback({
        transactionId: 'JC-123',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '999',
      });

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Insufficient funds');
    });

    it('should throw BadRequestException for missing transactionId', async () => {
      await expect(
        service.handlePaymentCallback({ paymentMethod: PaymentMethod.JAZZCASH }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no purchases found', async () => {
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.handlePaymentCallback({
          transactionId: 'UNKNOWN',
          paymentMethod: PaymentMethod.JAZZCASH,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('featureListing', () => {
    it('should feature a listing when seller has active featured package', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockPackagePurchaseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          type: AdPackageType.FEATURED_ADS,
          remainingQuantity: 3,
          expiresAt: futureDate,
        }),
      });

      const result = await service.featureListing(listingId.toString(), sellerId.toString());

      expect(result.isFeatured).toBe(true);
      expect(mockPackagePurchaseModel.updateOne).toHaveBeenCalledWith(
        { _id: purchaseId },
        { $inc: { remainingQuantity: -1 } },
      );
    });

    it('should throw ForbiddenException if not listing owner', async () => {
      const otherSellerId = new Types.ObjectId();
      await expect(
        service.featureListing(listingId.toString(), otherSellerId.toString()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if listing is already featured', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: listingId,
          sellerId,
          isFeatured: true,
        }),
      });

      await expect(
        service.featureListing(listingId.toString(), sellerId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no active featured package', async () => {
      await expect(
        service.featureListing(listingId.toString(), sellerId.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid listing id', async () => {
      await expect(
        service.featureListing('invalid-id', sellerId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAdLimit', () => {
    it('should return canPost true when under limit', async () => {
      const result = await service.checkAdLimit(sellerId.toString());
      expect(result.canPost).toBe(true);
      expect(result.activeAdCount).toBe(5);
      expect(result.adLimit).toBe(10);
      expect(result.message).toBeUndefined();
    });

    it('should return canPost false when at limit', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeAdCount: 10,
          adLimit: 10,
        }),
      });

      const result = await service.checkAdLimit(sellerId.toString());
      expect(result.canPost).toBe(false);
      expect(result.message).toContain('ad limit');
    });

    it('should throw NotFoundException for unknown seller', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.checkAdLimit(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleExpiredFeaturedAds', () => {
    it('should revert expired featured listings', async () => {
      const count = await service.handleExpiredFeaturedAds();
      expect(count).toBe(2);
      expect(mockListingModel.updateMany).toHaveBeenCalledWith(
        { isFeatured: true, featuredUntil: { $lte: expect.any(Date) } },
        { $set: { isFeatured: false }, $unset: { featuredUntil: '' } },
      );
    });
  });

  describe('createPackage', () => {
    it('should create a new package', async () => {
      const dto = {
        name: '5 Featured Ads - 7 Days',
        type: AdPackageType.FEATURED_ADS,
        duration: 7 as 7 | 15 | 30,
        quantity: 5,
        defaultPrice: 500,
      };

      const result = await service.createPackage(dto);

      expect(result).toBeDefined();
      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '5 Featured Ads - 7 Days',
          type: AdPackageType.FEATURED_ADS,
          duration: 7,
          quantity: 5,
          defaultPrice: 500,
          isActive: true,
        }),
      );
    });

    it('should create a package with category pricing', async () => {
      const categoryId = new Types.ObjectId().toString();
      const dto = {
        name: '10 Ad Slots - 30 Days',
        type: AdPackageType.AD_SLOTS,
        duration: 30 as 7 | 15 | 30,
        quantity: 10,
        defaultPrice: 1000,
        categoryPricing: [{ categoryId, price: 1200 }],
      };

      await service.createPackage(dto);

      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryPricing: expect.arrayContaining([
            expect.objectContaining({ price: 1200 }),
          ]),
        }),
      );
    });
  });

  describe('updatePackage', () => {
    it('should update package fields', async () => {
      const saveMock = jest.fn().mockResolvedValue({ ...mockPackage, defaultPrice: 600 });
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPackage,
          save: saveMock,
        }),
      });

      const result = await service.updatePackage(packageId.toString(), { defaultPrice: 600 });

      expect(saveMock).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.updatePackage('invalid-id', { defaultPrice: 600 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when package does not exist', async () => {
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updatePackage(new Types.ObjectId().toString(), { defaultPrice: 600 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update category pricing', async () => {
      const categoryId = new Types.ObjectId().toString();
      const saveMock = jest.fn().mockResolvedValue(mockPackage);
      const pkg = { ...mockPackage, categoryPricing: [], save: saveMock };
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(pkg),
      });

      await service.updatePackage(packageId.toString(), {
        categoryPricing: [{ categoryId, price: 750 }],
      });

      expect(pkg.categoryPricing).toHaveLength(1);
      expect(saveMock).toHaveBeenCalled();
    });
  });
});
