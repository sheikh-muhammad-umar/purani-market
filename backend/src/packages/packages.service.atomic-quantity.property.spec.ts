/**
 * Property 7: Atomic Non-Negative Quantity
 *
 * For any PackagePurchase, the remainingQuantity SHALL never be decremented
 * below zero, even under concurrent application requests. If remainingQuantity
 * is zero at the time of an atomic update attempt, the application SHALL be
 * rejected.
 *
 * **Validates: Requirements 7.5, 3.7**
 *
 * Tag: Feature: category-package-management, Property 7: Atomic Non-Negative Quantity
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
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
import { ERROR } from '../common/constants/error-messages';
import { AdminTrackerService } from '../ai/admin-tracker.service';

// Arbitrary for AdPackageType
const arbPackageType = fc.constantFrom(
  AdPackageType.FEATURED_ADS,
  AdPackageType.AD_SLOTS,
);

// Arbitrary for expiresAt: always in the future for valid purchases
const arbFutureExpiresAt = fc.integer({ min: 1, max: 30 }).map((days) => {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
});

describe('Property 7: Atomic Non-Negative Quantity', () => {
  it('Feature: category-package-management, Property 7: Atomic Non-Negative Quantity — concurrent apply on remainingQuantity=1', async () => {
    const sellerId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbPackageType,
        arbFutureExpiresAt,
        async (type, expiresAt) => {
          const purchaseId = new Types.ObjectId();
          const packageId = new Types.ObjectId();

          // Purchase with remainingQuantity=1 — edge case for concurrent access
          const purchase = {
            _id: purchaseId,
            sellerId,
            packageId,
            categoryId,
            type,
            quantity: 10,
            remainingQuantity: 1,
            duration: 7,
            price: 500,
            paymentMethod: PaymentMethod.JAZZCASH,
            paymentStatus: PaymentStatus.COMPLETED,
            expiresAt,
            activatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Track call count to simulate concurrent behavior:
          // First call: atomic update succeeds (returns updated doc with qty=0)
          // Second call: atomic update fails (returns null because qty is now 0)
          let findOneAndUpdateCallCount = 0;

          const mockPackagePurchaseModel: any = jest
            .fn()
            .mockImplementation(() => ({}));

          mockPackagePurchaseModel.findOneAndUpdate = jest
            .fn()
            .mockImplementation(() => {
              findOneAndUpdateCallCount++;
              if (findOneAndUpdateCallCount === 1) {
                // First attempt succeeds — returns updated doc with qty=0
                const updatedPurchase = {
                  ...purchase,
                  remainingQuantity: 0,
                  populate: jest.fn().mockResolvedValue({
                    ...purchase,
                    remainingQuantity: 0,
                    packageId: {
                      _id: packageId,
                      name: 'Test Package',
                      type,
                    },
                  }),
                };
                return { exec: jest.fn().mockResolvedValue(updatedPurchase) };
              }
              // Second attempt fails — returns null (qty is now 0, filter doesn't match)
              return { exec: jest.fn().mockResolvedValue(null) };
            });

          // findById returns the purchase with qty=0 (already consumed)
          // so the service can determine the specific rejection reason
          mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              ...purchase,
              remainingQuantity: 0,
            }),
          });

          mockPackagePurchaseModel.find = jest.fn();

          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn();

          const mockUserModel: any = { findById: jest.fn() };
          const mockListingModel: any = {
            findById: jest.fn(),
            updateMany: jest.fn(),
          };
          const mockPaymentsService: any = {};

          const module: TestingModule = await Test.createTestingModule({
            providers: [
              PackagesService,
              {
                provide: getModelToken(AdPackage.name),
                useValue: mockAdPackageModel,
              },
              {
                provide: getModelToken(PackagePurchase.name),
                useValue: mockPackagePurchaseModel,
              },
              {
                provide: getModelToken(User.name),
                useValue: mockUserModel,
              },
              {
                provide: getModelToken(ProductListing.name),
                useValue: mockListingModel,
              },
              {
                provide: PaymentsService,
                useValue: mockPaymentsService,
              },
              {
                provide: AdminTrackerService,
                useValue: { track: jest.fn().mockResolvedValue(undefined) },
              },
            ],
          }).compile();

          const service = module.get<PackagesService>(PackagesService);

          // First apply attempt — should succeed with qty=0
          const result = await service.applyPackageToListing(
            purchaseId.toString(),
            sellerId.toString(),
            categoryId.toString(),
          );

          expect(result.purchase.remainingQuantity).toBe(0);
          expect(result.packageDoc).toBeDefined();

          // Second apply attempt — should be rejected (qty is now 0)
          await expect(
            service.applyPackageToListing(
              purchaseId.toString(),
              sellerId.toString(),
              categoryId.toString(),
            ),
          ).rejects.toThrow(BadRequestException);

          await expect(
            service.applyPackageToListing(
              purchaseId.toString(),
              sellerId.toString(),
              categoryId.toString(),
            ),
          ).rejects.toThrow(ERROR.PACKAGE_FULLY_USED);

          // Verify the atomic filter always includes remainingQuantity: { $gt: 0 }
          // which prevents decrementing below zero
          const calls = mockPackagePurchaseModel.findOneAndUpdate.mock.calls;
          for (const call of calls) {
            const filter = call[0];
            expect(filter.remainingQuantity).toEqual({ $gt: 0 });
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  it('Feature: category-package-management, Property 7: Atomic Non-Negative Quantity — remainingQuantity=0 always rejects', async () => {
    const sellerId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbPackageType,
        arbFutureExpiresAt,
        async (type, expiresAt) => {
          const purchaseId = new Types.ObjectId();
          const packageId = new Types.ObjectId();

          // Purchase with remainingQuantity=0 — should always reject
          const purchase = {
            _id: purchaseId,
            sellerId,
            packageId,
            categoryId,
            type,
            quantity: 10,
            remainingQuantity: 0,
            duration: 7,
            price: 500,
            paymentMethod: PaymentMethod.JAZZCASH,
            paymentStatus: PaymentStatus.COMPLETED,
            expiresAt,
            activatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const mockPackagePurchaseModel: any = jest
            .fn()
            .mockImplementation(() => ({}));

          // findOneAndUpdate returns null because remainingQuantity is 0
          // and the filter requires $gt: 0
          mockPackagePurchaseModel.findOneAndUpdate = jest
            .fn()
            .mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            });

          // findById returns the purchase with qty=0 for error diagnosis
          mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(purchase),
          });

          mockPackagePurchaseModel.find = jest.fn();

          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn();

          const mockUserModel: any = { findById: jest.fn() };
          const mockListingModel: any = {
            findById: jest.fn(),
            updateMany: jest.fn(),
          };
          const mockPaymentsService: any = {};

          const module: TestingModule = await Test.createTestingModule({
            providers: [
              PackagesService,
              {
                provide: getModelToken(AdPackage.name),
                useValue: mockAdPackageModel,
              },
              {
                provide: getModelToken(PackagePurchase.name),
                useValue: mockPackagePurchaseModel,
              },
              {
                provide: getModelToken(User.name),
                useValue: mockUserModel,
              },
              {
                provide: getModelToken(ProductListing.name),
                useValue: mockListingModel,
              },
              {
                provide: PaymentsService,
                useValue: mockPaymentsService,
              },
              {
                provide: AdminTrackerService,
                useValue: { track: jest.fn().mockResolvedValue(undefined) },
              },
            ],
          }).compile();

          const service = module.get<PackagesService>(PackagesService);

          // Should always reject with "fully used" message
          await expect(
            service.applyPackageToListing(
              purchaseId.toString(),
              sellerId.toString(),
              categoryId.toString(),
            ),
          ).rejects.toThrow(BadRequestException);

          await expect(
            service.applyPackageToListing(
              purchaseId.toString(),
              sellerId.toString(),
              categoryId.toString(),
            ),
          ).rejects.toThrow(ERROR.PACKAGE_FULLY_USED);

          // Verify the atomic filter includes remainingQuantity: { $gt: 0 }
          const filterArg =
            mockPackagePurchaseModel.findOneAndUpdate.mock.calls[0][0];
          expect(filterArg.remainingQuantity).toEqual({ $gt: 0 });
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
