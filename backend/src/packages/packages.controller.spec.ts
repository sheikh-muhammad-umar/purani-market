import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { AdPackageType } from './schemas/ad-package.schema';
import {
  PaymentMethod,
  PaymentStatus,
} from './schemas/package-purchase.schema';
import { EntitlementKind } from './entitlement.types';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminTrackerService } from '../ai/admin-tracker.service';

describe('PackagesController', () => {
  let controller: PackagesController;
  let service: PackagesService;

  const packageId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
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
  };

  const mockPackages = [mockPackage];

  const mockPurchaseResult = {
    purchases: [{ _id: purchaseId, sellerId, packageId }],
    redirectUrl: 'https://sandbox.jazzcash.com.pk/checkout?txn=JC-123',
    transactionId: 'JC-123',
  };

  const mockPackagesService = {
    findAll: jest.fn().mockResolvedValue(mockPackages),
    findById: jest.fn().mockResolvedValue(mockPackage),
    purchasePackages: jest.fn().mockResolvedValue(mockPurchaseResult),
    getMyPurchases: jest.fn().mockResolvedValue([]),
    handlePaymentCallback: jest.fn().mockResolvedValue({
      status: 'success',
      message: 'Packages activated successfully',
    }),
    createPackage: jest.fn().mockResolvedValue(mockPackage),
    updatePackage: jest.fn().mockResolvedValue(mockPackage),
    deletePackage: jest.fn().mockResolvedValue({
      id: packageId.toString(),
      deleted: true,
      purchaseCount: 0,
    }),
  };

  /** A well-formed all-in-one payload: every kind an all-in-one must include. */
  const bundleEntitlements = [
    { kind: EntitlementKind.FEATURED_ADS, quantity: 2 },
    { kind: EntitlementKind.AD_SLOTS, quantity: 10 },
    { kind: EntitlementKind.SHORTS, quantity: 5 },
  ];

  beforeEach(async () => {
    // The service double is shared across cases, so call history has to be dropped
    // between them: the permission tests assert a write did *not* happen, which an
    // earlier case's call would otherwise satisfy. `clearAllMocks` drops history
    // without removing the resolved values configured above.
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackagesController],
      providers: [
        { provide: PackagesService, useValue: mockPackagesService },
        { provide: AdminTrackerService, useValue: { track: jest.fn() } },
      ],
    }).compile();

    controller = module.get<PackagesController>(PackagesController);
    service = module.get<PackagesService>(PackagesService);
  });

  describe('findAll', () => {
    it('should return all active packages', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockPackages);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a package by id', async () => {
      const result = await controller.findById(packageId.toString());
      expect(result).toEqual(mockPackage);
      expect(service.findById).toHaveBeenCalledWith(packageId.toString());
    });

    it('should propagate NotFoundException from service', async () => {
      mockPackagesService.findById.mockRejectedValueOnce(
        new NotFoundException('Package not found'),
      );
      await expect(controller.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('purchasePackages', () => {
    it('should create purchases and return redirect URL', async () => {
      const dto = {
        items: [{ packageId: packageId.toString() }],
        paymentMethod: PaymentMethod.JAZZCASH,
      };

      const result = await controller.purchasePackages(
        sellerId.toString(),
        dto,
      );

      expect(result.redirectUrl).toContain('jazzcash');
      expect(result.transactionId).toBe('JC-123');
      expect(service.purchasePackages).toHaveBeenCalledWith(
        sellerId.toString(),
        dto,
      );
    });
  });

  describe('getMyPurchases', () => {
    it('should return seller purchase history', async () => {
      const result = await controller.getMyPurchases(sellerId.toString());
      expect(result).toEqual([]);
      expect(service.getMyPurchases).toHaveBeenCalledWith(
        sellerId.toString(),
        undefined,
      );
    });

    it('should pass categoryId filter when provided', async () => {
      const categoryId = new Types.ObjectId().toString();
      await controller.getMyPurchases(sellerId.toString(), categoryId);
      expect(service.getMyPurchases).toHaveBeenCalledWith(
        sellerId.toString(),
        categoryId,
      );
    });

    it('should throw BadRequestException for invalid categoryId', async () => {
      await expect(
        controller.getMyPurchases(sellerId.toString(), 'invalid-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('paymentCallback', () => {
    it('should handle payment callback', async () => {
      const payload = {
        transactionId: 'JC-123',
        paymentMethod: PaymentMethod.JAZZCASH,
        responseCode: '000',
      };

      const result = await controller.paymentCallback(payload);

      expect(result.status).toBe('success');
      expect(service.handlePaymentCallback).toHaveBeenCalledWith(payload);
    });
  });

  describe('createPackage', () => {
    it('should create a new package (admin only)', async () => {
      const dto = {
        name: '5 Featured Ads - 7 Days',
        type: AdPackageType.FEATURED_ADS,
        duration: 7 as 7 | 15 | 30,
        quantity: 5,
        defaultPrice: 500,
      };

      const result = await controller.createPackage(
        dto,
        'admin-id',
        UserRole.ADMIN,
        {},
      );

      expect(result).toEqual(mockPackage);
      expect(service.createPackage).toHaveBeenCalledWith(dto);
    });

    it('should refuse an all-in-one package from a plain admin', async () => {
      const dto = {
        name: 'All in One 30',
        duration: 30,
        defaultPrice: 1800,
        entitlements: bundleEntitlements,
      };

      await expect(
        controller.createPackage(dto, 'admin-id', UserRole.ADMIN, {}),
      ).rejects.toThrow(ForbiddenException);
      expect(service.createPackage).not.toHaveBeenCalledWith(dto);
    });

    it('should allow a super admin to create an all-in-one package', async () => {
      const dto = {
        name: 'All in One 30',
        duration: 30,
        defaultPrice: 1800,
        entitlements: bundleEntitlements,
      };

      await controller.createPackage(dto, 'admin-id', UserRole.SUPER_ADMIN, {});

      expect(service.createPackage).toHaveBeenCalledWith(dto);
    });
  });

  describe('updatePackage', () => {
    it('should update an existing package (admin only)', async () => {
      const dto = { defaultPrice: 600 };

      const result = await controller.updatePackage(
        packageId.toString(),
        dto,
        'admin-id',
        UserRole.ADMIN,
        {},
      );

      expect(result).toEqual(mockPackage);
      expect(service.updatePackage).toHaveBeenCalledWith(
        packageId.toString(),
        dto,
      );
    });

    it('should refuse an edit to an all-in-one package from a plain admin', async () => {
      mockPackagesService.findById.mockResolvedValueOnce({
        ...mockPackage,
        type: AdPackageType.BUNDLE,
      });

      await expect(
        controller.updatePackage(
          packageId.toString(),
          { defaultPrice: 600 },
          'admin-id',
          UserRole.ADMIN,
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.updatePackage).not.toHaveBeenCalled();
    });

    it('should refuse a plain admin converting a package into an all-in-one', async () => {
      await expect(
        controller.updatePackage(
          packageId.toString(),
          { entitlements: bundleEntitlements },
          'admin-id',
          UserRole.ADMIN,
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.updatePackage).not.toHaveBeenCalled();
    });
  });

  describe('deletePackage', () => {
    it('should delete a single-purpose package for an admin', async () => {
      const result = await controller.deletePackage(
        packageId.toString(),
        'admin-id',
        UserRole.ADMIN,
        {},
      );

      expect(result).toEqual({
        id: packageId.toString(),
        deleted: true,
        purchaseCount: 0,
      });
      expect(service.deletePackage).toHaveBeenCalledWith(packageId.toString());
    });

    it('should refuse deleting an all-in-one package as a plain admin', async () => {
      mockPackagesService.findById.mockResolvedValueOnce({
        ...mockPackage,
        type: AdPackageType.BUNDLE,
      });

      await expect(
        controller.deletePackage(
          packageId.toString(),
          'admin-id',
          UserRole.ADMIN,
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(service.deletePackage).not.toHaveBeenCalled();
    });
  });
});
