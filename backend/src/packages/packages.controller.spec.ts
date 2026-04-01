import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { AdPackageType } from './schemas/ad-package.schema';
import { PaymentMethod, PaymentStatus } from './schemas/package-purchase.schema';

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackagesController],
      providers: [
        { provide: PackagesService, useValue: mockPackagesService },
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

      const result = await controller.purchasePackages(sellerId.toString(), dto);

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
      expect(service.getMyPurchases).toHaveBeenCalledWith(sellerId.toString());
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

      const result = await controller.createPackage(dto);

      expect(result).toEqual(mockPackage);
      expect(service.createPackage).toHaveBeenCalledWith(dto);
    });
  });

  describe('updatePackage', () => {
    it('should update an existing package (admin only)', async () => {
      const dto = { defaultPrice: 600 };

      const result = await controller.updatePackage(packageId.toString(), dto);

      expect(result).toEqual(mockPackage);
      expect(service.updatePackage).toHaveBeenCalledWith(
        packageId.toString(),
        dto,
      );
    });
  });
});
