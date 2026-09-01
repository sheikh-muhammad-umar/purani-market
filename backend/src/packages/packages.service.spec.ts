import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesService } from './packages.service';
import { EntitlementKind } from './entitlements';
import { AdPackage, AdPackageType } from './schemas/ad-package.schema';
import {
  PackagePurchase,
  PaymentMethod,
  PaymentStatus,
} from './schemas/package-purchase.schema';
import { User } from '../users/schemas/user.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { PaymentsService } from '../payments/payments.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { daysToMs } from '../common/utils/time';

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
  let mockNotificationsService: any;
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
    mockAdPackageModel.constructor = jest
      .fn()
      .mockImplementation(() => mockCreatedPackage);
    // For createPackage - the service uses `new this.adPackageModel(...)` which is the model itself as constructor
    // We need to make the model callable as a constructor
    const originalFind = mockAdPackageModel.find;
    const originalFindById = mockAdPackageModel.findById;
    const constructorFn: any = jest
      .fn()
      .mockImplementation(() => mockCreatedPackage);
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

    mockPackagePurchaseModel = jest
      .fn()
      .mockImplementation(() => mockSavedPurchase);
    mockPackagePurchaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
          exec: jest.fn().mockResolvedValue([]),
        }),
        // featureListing shortlists candidates before spending one.
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
        exec: jest.fn().mockResolvedValue([]),
      }),
      exec: jest.fn().mockResolvedValue([]),
    });

    /** Shortlist featureListing should find, in expiry order. */
    const stubFeaturedCandidates = (ids: Types.ObjectId[]) => {
      mockPackagePurchaseModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(ids.map((_id) => ({ _id }))),
          }),
        }),
      });
    };
    mockPackagePurchaseModel.stubFeaturedCandidates = stubFeaturedCandidates;
    mockPackagePurchaseModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPackagePurchaseModel.findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockPackagePurchaseModel.updateMany = jest
      .fn()
      .mockResolvedValue({ modifiedCount: 1 });
    mockPackagePurchaseModel.updateOne = jest
      .fn()
      .mockResolvedValue({ modifiedCount: 1 });

    mockNotificationsService = {
      sendPurchaseRefundedNotification: jest.fn().mockResolvedValue(true),
    };

    mockUserModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeListingCount: 5,
          listingLimit: 10,
          baseListingLimit: 10,
        }),
        // reconcileListingLimit narrows to the two limit fields.
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: sellerId,
            listingLimit: 10,
            baseListingLimit: 10,
          }),
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
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
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
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: getModelToken(AdPackage.name),
          useValue: mockAdPackageModel,
        },
        {
          provide: getModelToken(PackagePurchase.name),
          useValue: mockPackagePurchaseModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        { provide: PaymentsService, useValue: mockPaymentsService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'listing.defaultListingLimit' ? 10 : undefined,
          },
        },
        {
          provide: AdminTrackerService,
          useValue: { track: jest.fn().mockResolvedValue(undefined) },
        },
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
      await expect(service.findById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when package does not exist', async () => {
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.findById(new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
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

    it('should use category-specific price when categoryPricing entry matches', async () => {
      const categoryId = new Types.ObjectId();
      const packageWithCatPricing = {
        ...mockPackage,
        defaultPrice: 500,
        categoryPricing: [
          { categoryId, price: 750 },
          { categoryId: new Types.ObjectId(), price: 900 },
        ],
      };
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(packageWithCatPricing),
      });

      const dto = {
        items: [
          {
            packageId: packageId.toString(),
            categoryId: categoryId.toString(),
          },
        ],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      await service.purchasePackages(sellerId.toString(), dto);

      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        PaymentMethod.JAZZCASH,
        expect.objectContaining({ amount: 750 }),
      );
    });

    it('should use defaultPrice when no categoryPricing entry matches', async () => {
      const unmatchedCategoryId = new Types.ObjectId();
      const packageWithCatPricing = {
        ...mockPackage,
        defaultPrice: 500,
        categoryPricing: [{ categoryId: new Types.ObjectId(), price: 750 }],
      };
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(packageWithCatPricing),
      });

      const dto = {
        items: [
          {
            packageId: packageId.toString(),
            categoryId: unmatchedCategoryId.toString(),
          },
        ],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      await service.purchasePackages(sellerId.toString(), dto);

      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        PaymentMethod.JAZZCASH,
        expect.objectContaining({ amount: 500 }),
      );
    });

    it('should use defaultPrice when no categoryId is provided', async () => {
      const dto = {
        items: [{ packageId: packageId.toString() }],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      await service.purchasePackages(sellerId.toString(), dto);

      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        PaymentMethod.JAZZCASH,
        expect.objectContaining({ amount: 500 }),
      );
    });

    it('should store categoryId on the purchase record when provided', async () => {
      const categoryId = new Types.ObjectId();
      const dto = {
        items: [
          {
            packageId: packageId.toString(),
            categoryId: categoryId.toString(),
          },
        ],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      await service.purchasePackages(sellerId.toString(), dto);

      expect(mockPackagePurchaseModel).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: expect.any(Types.ObjectId),
        }),
      );
    });

    it('should support purchasing multiple packages simultaneously', async () => {
      const pkg2Id = new Types.ObjectId();
      let callCount = 0;
      mockAdPackageModel.findById.mockImplementation(() => ({
        exec: jest
          .fn()
          .mockResolvedValue(
            callCount++ === 0
              ? mockPackage
              : { ...mockAdSlotsPackage, _id: pkg2Id },
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

    it('should filter by categoryId when provided', async () => {
      const categoryId = new Types.ObjectId().toString();
      await service.getMyPurchases(sellerId.toString(), categoryId);
      expect(mockPackagePurchaseModel.find).toHaveBeenCalledWith({
        sellerId: expect.any(Types.ObjectId),
        categoryId: expect.any(Types.ObjectId),
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
      // Guarded on PENDING so a replayed callback cannot activate twice.
      expect(mockPackagePurchaseModel.updateOne).toHaveBeenCalledWith(
        { _id: purchaseId, paymentStatus: PaymentStatus.PENDING },
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: PaymentStatus.COMPLETED,
          }),
        }),
      );
      // The limit is derived — base allowance plus the slots of every active
      // package — so activation recomputes it rather than incrementing. That is
      // what makes it safe against replays and against an admin editing the base.
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $set: { baseListingLimit: 10, listingLimit: 20 } },
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
        service.handlePaymentCallback({
          paymentMethod: PaymentMethod.JAZZCASH,
        }),
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

  describe('bundles', () => {
    it('derives type and total quantity from an entitlement list', async () => {
      await service.createPackage({
        name: 'All in one',
        duration: 30,
        defaultPrice: 5000,
        entitlements: [
          { kind: EntitlementKind.AD_SLOTS, quantity: 10 },
          { kind: EntitlementKind.FEATURED_ADS, quantity: 5 },
          { kind: EntitlementKind.SHORTS, quantity: 3 },
        ],
      } as any);

      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'All in one',
          type: AdPackageType.BUNDLE,
          // Headline figure only — spending is tracked per entitlement.
          quantity: 18,
          entitlements: [
            { kind: EntitlementKind.AD_SLOTS, quantity: 10 },
            { kind: EntitlementKind.FEATURED_ADS, quantity: 5 },
            { kind: EntitlementKind.SHORTS, quantity: 3 },
          ],
        }),
      );
    });

    it('keeps the list for a shorts-only package, which has no legacy type', async () => {
      // Regression: dropping it left `type: bundle` with an empty list, which
      // reads as granting nothing — the package would sell and deliver zero.
      await service.createPackage({
        name: 'Shorts only',
        duration: 30,
        defaultPrice: 400,
        entitlements: [{ kind: EntitlementKind.SHORTS, quantity: 5 }],
      } as any);

      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AdPackageType.BUNDLE,
          entitlements: [{ kind: EntitlementKind.SHORTS, quantity: 5 }],
        }),
      );
    });

    it('stores a single entitlement as its historical type, not a bundle', async () => {
      await service.createPackage({
        name: 'Slots only',
        duration: 30,
        defaultPrice: 300,
        entitlements: [{ kind: EntitlementKind.AD_SLOTS, quantity: 5 }],
      } as any);

      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AdPackageType.AD_SLOTS,
          quantity: 5,
          // Left empty: type + quantity already describe it, and a second copy
          // would be one more thing to keep in step.
          entitlements: [],
        }),
      );
    });

    it('sums a kind listed twice rather than tracking it twice', async () => {
      await service.createPackage({
        name: 'Double shorts',
        duration: 30,
        defaultPrice: 900,
        entitlements: [
          { kind: EntitlementKind.SHORTS, quantity: 3 },
          { kind: EntitlementKind.SHORTS, quantity: 2 },
        ],
      } as any);

      expect(mockAdPackageModel).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AdPackageType.BUNDLE,
          quantity: 5,
          entitlements: [{ kind: EntitlementKind.SHORTS, quantity: 5 }],
        }),
      );
    });

    it('refuses a bundle expressed in the legacy type + quantity form', async () => {
      // `bundle` says nothing about what is granted, so it would grant nothing.
      await expect(
        service.createPackage({
          name: 'Broken bundle',
          type: AdPackageType.BUNDLE,
          duration: 30,
          quantity: 10,
          defaultPrice: 1000,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a package that grants nothing at all', async () => {
      await expect(
        service.createPackage({
          name: 'Empty',
          duration: 30,
          defaultPrice: 1000,
          entitlements: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("credits a bundle's ad slots on activation", async () => {
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: purchaseId,
            sellerId,
            type: AdPackageType.BUNDLE,
            quantity: 18,
            remainingQuantity: 18,
            duration: 30,
            entitlements: [
              { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
              { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 5 },
              { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 3 },
            ],
          },
        ]),
      });

      const result = await service.handlePaymentCallback({
        transactionId: 'JC-BUNDLE',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '000',
      });

      expect(result.status).toBe('success');
      // Only the slots reach the limit; featured ads and shorts are spent from the
      // purchase row as they are used.
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $set: { baseListingLimit: 10, listingLimit: 20 } },
      );
      expect(mockUserModel.updateOne).toHaveBeenCalledTimes(1);
    });

    it('does not credit a bundle that grants no slots', async () => {
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: purchaseId,
            sellerId,
            type: AdPackageType.BUNDLE,
            quantity: 8,
            remainingQuantity: 8,
            duration: 30,
            entitlements: [
              { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 5 },
              { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 3 },
            ],
          },
        ]),
      });

      await service.handlePaymentCallback({
        transactionId: 'JC-NOSLOTS',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '000',
      });

      expect(mockUserModel.updateOne).not.toHaveBeenCalled();
    });

    it('ignores a replayed callback instead of granting twice', async () => {
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: purchaseId,
            sellerId,
            type: AdPackageType.AD_SLOTS,
            quantity: 10,
            remainingQuantity: 10,
            duration: 30,
          },
        ]),
      });
      // Second delivery of the same callback: the purchase is no longer PENDING,
      // so the guarded activation matches nothing. Gateways retry and users
      // refresh the return URL, and this used to re-credit the slots every time.
      mockPackagePurchaseModel.updateOne.mockResolvedValue({
        modifiedCount: 0,
      });

      const result = await service.handlePaymentCallback({
        transactionId: 'JC-REPLAY',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '000',
      });

      expect(result.status).toBe('success');
      expect(mockUserModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('refundPurchase', () => {
    const adminId = new Types.ObjectId().toString();

    const stubPurchase = (over: Record<string, unknown> = {}) => {
      const doc = {
        _id: purchaseId,
        sellerId,
        packageId,
        type: AdPackageType.AD_SLOTS,
        quantity: 10,
        remainingQuantity: 10,
        price: 2000,
        currency: 'PKR',
        paymentStatus: PaymentStatus.COMPLETED,
        entitlements: [],
        ...over,
      };
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      return doc;
    };

    beforeEach(() => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: sellerId,
            baseListingLimit: 10,
            listingLimit: 20,
          }),
        }),
        exec: jest.fn().mockResolvedValue({ _id: sellerId, listingLimit: 20 }),
      });
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      mockAdPackageModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ name: 'Extra Slots' }),
        }),
        exec: jest.fn().mockResolvedValue({ name: 'Extra Slots' }),
      });
    });

    it('marks the purchase refunded and withdraws unused allowance', async () => {
      stubPurchase();
      await service.refundPurchase(
        purchaseId.toString(),
        adminId,
        'duplicate charge',
      );

      const [filter, update] = mockPackagePurchaseModel.updateOne.mock.calls[0];
      // Guarded on the status so two concurrent refunds cannot both withdraw.
      expect(filter).toEqual({
        _id: purchaseId,
        paymentStatus: PaymentStatus.COMPLETED,
      });
      expect(update.$set.paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(update.$set.remainingQuantity).toBe(0);
      expect(update.$set.refundReason).toBe('duplicate charge');
      expect(update.$set.refundedAt).toBeInstanceOf(Date);
    });

    it('zeroes every entitlement balance on a bundle', async () => {
      stubPurchase({
        type: AdPackageType.BUNDLE,
        entitlements: [
          { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
          { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 2 },
        ],
      });

      await service.refundPurchase(purchaseId.toString(), adminId);

      const update = mockPackagePurchaseModel.updateOne.mock.calls[0][1];
      expect(update.$set.entitlements).toEqual([
        { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 0 },
        { kind: EntitlementKind.FEATURED_ADS, quantity: 5, remaining: 0 },
      ]);
    });

    it('recomputes the listing limit, so refunded slots stop counting', async () => {
      stubPurchase();
      await service.refundPurchase(purchaseId.toString(), adminId);
      // reconcileListingLimit only counts completed purchases, so the refunded
      // one drops out without any subtraction here.
      expect(mockUserModel.updateOne).toHaveBeenCalled();
    });

    it('tells the seller, naming the amount and the reason', async () => {
      stubPurchase();
      await service.refundPurchase(purchaseId.toString(), adminId, 'goodwill');

      expect(
        mockNotificationsService.sendPurchaseRefundedNotification,
      ).toHaveBeenCalledWith(
        sellerId.toString(),
        'Extra Slots',
        2000,
        'PKR',
        'goodwill',
      );
    });

    it('is idempotent — refunding twice withdraws once', async () => {
      stubPurchase({ paymentStatus: PaymentStatus.REFUNDED });
      await service.refundPurchase(purchaseId.toString(), adminId);
      expect(mockPackagePurchaseModel.updateOne).not.toHaveBeenCalled();
    });

    it('refuses a purchase that was never charged', async () => {
      stubPurchase({ paymentStatus: PaymentStatus.PENDING });
      await expect(
        service.refundPurchase(purchaseId.toString(), adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown purchase', async () => {
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.refundPurchase(new Types.ObjectId().toString(), adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reconcileListingLimit', () => {
    /** Slot purchases the seller currently holds. */
    const stubSlotPurchases = (rows: Record<string, unknown>[]) => {
      mockPackagePurchaseModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(rows),
      });
    };
    const stubUser = (base: number, effective: number) => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: sellerId,
            baseListingLimit: base,
            listingLimit: effective,
          }),
        }),
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          baseListingLimit: base,
          listingLimit: effective,
        }),
      });
    };

    it('derives the limit from the base plus active slot grants', async () => {
      stubUser(10, 10);
      stubSlotPurchases([
        { type: AdPackageType.AD_SLOTS, quantity: 5, remainingQuantity: 5 },
        {
          type: AdPackageType.BUNDLE,
          quantity: 8,
          remainingQuantity: 8,
          entitlements: [
            { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
            { kind: EntitlementKind.SHORTS, quantity: 3, remaining: 3 },
          ],
        },
      ]);

      // 10 base + 5 + 10; the bundle's shorts are not slots.
      await expect(
        service.reconcileListingLimit(sellerId.toString()),
      ).resolves.toBe(25);
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $set: { baseListingLimit: 10, listingLimit: 25 } },
      );
    });

    it('is idempotent, so a replayed activation cannot inflate the limit', async () => {
      // The old `$inc` added again on every delivery of a duplicated callback.
      stubUser(10, 15);
      stubSlotPurchases([
        { type: AdPackageType.AD_SLOTS, quantity: 5, remainingQuantity: 5 },
      ]);

      await service.reconcileListingLimit(sellerId.toString());
      await service.reconcileListingLimit(sellerId.toString());

      // Already correct, so nothing is written either time.
      expect(mockUserModel.updateOne).not.toHaveBeenCalled();
    });

    it('honours an admin lowering the base while a package is live', async () => {
      // Previously expiry computed max(default, limit - snapshot), which could
      // *raise* a limit an admin had deliberately lowered.
      stubUser(3, 3);
      stubSlotPurchases([
        { type: AdPackageType.AD_SLOTS, quantity: 20, remainingQuantity: 20 },
      ]);

      await expect(
        service.reconcileListingLimit(sellerId.toString()),
      ).resolves.toBe(23);
    });

    it('returns to the base once every package has expired', async () => {
      // Expired purchases drop out of the query on their own, so no subtraction
      // and no floor is involved — two packages lapsing together cannot under-claw.
      stubUser(3, 23);
      stubSlotPurchases([]);

      await expect(
        service.reconcileListingLimit(sellerId.toString()),
      ).resolves.toBe(3);
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: sellerId },
        { $set: { baseListingLimit: 3, listingLimit: 3 } },
      );
    });

    it('falls back to the configured default for users predating the base field', async () => {
      stubUser(undefined as unknown as number, 10);
      stubSlotPurchases([
        { type: AdPackageType.AD_SLOTS, quantity: 5, remainingQuantity: 5 },
      ]);

      // 10 from config, not 0.
      await expect(
        service.reconcileListingLimit(sellerId.toString()),
      ).resolves.toBe(15);
    });
  });

  describe('legacy purchases written before entitlements existed', () => {
    /**
     * Those documents have no `entitlements` field at all, and MongoDB does not
     * match a missing field against `$size: 0`. Filtering on it made every
     * pre-existing purchase impossible to spend — no promoting a listing, no
     * applying a package, no paid short — while every mocked test still passed,
     * because a hand-written mock does not implement `$size`.
     *
     * So this asserts the shape of the filter instead: no condition on
     * `entitlements` may appear on the legacy branch. The discriminator (`type`
     * for ads, `purchaseType` for shorts) is what separates the two shapes, and a
     * bundle can never match it.
     */
    it('spends without any condition on the entitlements field', async () => {
      mockPackagePurchaseModel.stubFeaturedCandidates([purchaseId]);
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          type: AdPackageType.FEATURED_ADS,
          remainingQuantity: 2,
          expiresAt: new Date(Date.now() + daysToMs(7)),
        }),
      });

      await service.featureListing(listingId.toString(), sellerId.toString());

      const legacyFilter =
        mockPackagePurchaseModel.findOneAndUpdate.mock.calls[0][0];
      expect(legacyFilter.type).toBe(AdPackageType.FEATURED_ADS);
      expect(legacyFilter.remainingQuantity).toEqual({ $gt: 0 });
      expect(legacyFilter).not.toHaveProperty('entitlements');
    });

    it('keeps the candidate search free of it too', async () => {
      mockPackagePurchaseModel.stubFeaturedCandidates([]);
      await expect(
        service.featureListing(listingId.toString(), sellerId.toString()),
      ).rejects.toThrow(BadRequestException);

      const candidateFilter = mockPackagePurchaseModel.find.mock.calls[0][0];
      const legacyBranch = candidateFilter.$or.find(
        (branch: Record<string, unknown>) => 'remainingQuantity' in branch,
      );
      expect(legacyBranch).toBeDefined();
      expect(legacyBranch).not.toHaveProperty('entitlements');
      // The bundle branch still keys off the array, which is correct: a missing
      // field should not match it.
      const bundleBranch = candidateFilter.$or.find(
        (branch: Record<string, unknown>) => 'entitlements' in branch,
      );
      expect(bundleBranch.entitlements.$elemMatch.kind).toBe(
        EntitlementKind.FEATURED_ADS,
      );
    });
  });

  describe('featureListing', () => {
    it('should feature a listing when seller has active featured package', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockPackagePurchaseModel.stubFeaturedCandidates([purchaseId]);
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          type: AdPackageType.FEATURED_ADS,
          remainingQuantity: 2,
          expiresAt: futureDate,
        }),
      });

      const result = await service.featureListing(
        listingId.toString(),
        sellerId.toString(),
      );

      expect(result.isFeatured).toBe(true);
      // Spent conditionally rather than read-then-written, so two concurrent
      // promotions cannot both consume the same unit.
      expect(mockPackagePurchaseModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: purchaseId,
          remainingQuantity: { $gt: 0 },
        }),
        { $inc: { remainingQuantity: -1 } },
        { new: true },
      );
    });

    it('should spend the soonest-expiring credit first', async () => {
      const soon = new Date(Date.now() + daysToMs(2));
      const later = new Date(Date.now() + daysToMs(20));
      const soonId = new Types.ObjectId();
      const laterId = new Types.ObjectId();

      const sortSpy = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([{ _id: soonId }, { _id: laterId }]),
        }),
      });
      mockPackagePurchaseModel.find.mockReturnValue({ sort: sortSpy });
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: soonId,
          sellerId,
          type: AdPackageType.FEATURED_ADS,
          remainingQuantity: 0,
          expiresAt: soon,
        }),
      });

      await service.featureListing(listingId.toString(), sellerId.toString());

      expect(sortSpy).toHaveBeenCalledWith({ expiresAt: 1 });
      // The nearer expiry is attempted first, so credit about to lapse is used
      // before credit that still has weeks left.
      expect(
        mockPackagePurchaseModel.findOneAndUpdate.mock.calls[0][0],
      ).toEqual(expect.objectContaining({ _id: soonId }));
      void later;
      void laterId;
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

  describe('checkListingLimit', () => {
    it('should return canPost true when under limit', async () => {
      const result = await service.checkListingLimit(sellerId.toString());
      expect(result.canPost).toBe(true);
      expect(result.activeListingCount).toBe(5);
      expect(result.listingLimit).toBe(10);
      expect(result.message).toBeUndefined();
    });

    it('should return canPost false when at limit', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: sellerId,
          activeListingCount: 10,
          listingLimit: 10,
        }),
      });

      const result = await service.checkListingLimit(sellerId.toString());
      expect(result.canPost).toBe(false);
      expect(result.message).toContain('listing limit');
    });

    it('should throw NotFoundException for unknown seller', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.checkListingLimit(new Types.ObjectId().toString()),
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

  describe('applyPackageToListing', () => {
    const categoryId = new Types.ObjectId();
    const futureDate = new Date(Date.now() + daysToMs(7));

    it('should atomically decrement and return purchase + packageDoc on success', async () => {
      const updatedPurchase = {
        _id: purchaseId,
        sellerId,
        categoryId,
        packageId: {
          _id: packageId,
          name: '5 Featured Ads',
          type: AdPackageType.FEATURED_ADS,
        },
        remainingQuantity: 4,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: futureDate,
        populate: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          categoryId,
          packageId: {
            _id: packageId,
            name: '5 Featured Ads',
            type: AdPackageType.FEATURED_ADS,
          },
          remainingQuantity: 4,
        }),
      };
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedPurchase),
      });

      const result = await service.applyPackageToListing(
        purchaseId.toString(),
        sellerId.toString(),
        categoryId.toString(),
      );

      expect(result.purchase).toBeDefined();
      expect(mockPackagePurchaseModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(Types.ObjectId),
          sellerId: expect.any(Types.ObjectId),
          categoryId: expect.any(Types.ObjectId),
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: { $gt: 0 },
          expiresAt: { $gt: expect.any(Date) },
        }),
        { $inc: { remainingQuantity: -1 } },
        { new: true },
      );
    });

    it('should throw NotFoundException when purchase does not exist', async () => {
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.applyPackageToListing(
          new Types.ObjectId().toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when seller does not own the purchase', async () => {
      const otherSellerId = new Types.ObjectId();
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId: otherSellerId,
          categoryId,
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: 3,
          expiresAt: futureDate,
        }),
      });

      await expect(
        service.applyPackageToListing(
          purchaseId.toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for category mismatch', async () => {
      const otherCategoryId = new Types.ObjectId();
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          categoryId: otherCategoryId,
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: 3,
          expiresAt: futureDate,
        }),
      });

      await expect(
        service.applyPackageToListing(
          purchaseId.toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when package is fully used', async () => {
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          categoryId,
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: 0,
          expiresAt: futureDate,
        }),
      });

      await expect(
        service.applyPackageToListing(
          purchaseId.toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when package has expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          categoryId,
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: 3,
          expiresAt: pastDate,
        }),
      });

      await expect(
        service.applyPackageToListing(
          purchaseId.toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when payment is not completed', async () => {
      mockPackagePurchaseModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPackagePurchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: purchaseId,
          sellerId,
          categoryId,
          paymentStatus: PaymentStatus.PENDING,
          remainingQuantity: 3,
          expiresAt: futureDate,
        }),
      });

      await expect(
        service.applyPackageToListing(
          purchaseId.toString(),
          sellerId.toString(),
          categoryId.toString(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePackage', () => {
    it('should update package fields', async () => {
      const saveMock = jest
        .fn()
        .mockResolvedValue({ ...mockPackage, defaultPrice: 600 });
      mockAdPackageModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPackage,
          save: saveMock,
        }),
      });

      const result = await service.updatePackage(packageId.toString(), {
        defaultPrice: 600,
      });

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
        service.updatePackage(new Types.ObjectId().toString(), {
          defaultPrice: 600,
        }),
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
