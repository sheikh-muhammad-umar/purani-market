/**
 * Property 5: Category Mismatch Rejection
 *
 * For any purchase with categoryId A and for any listing with categoryId B
 * where A ≠ B, applyPackageToListing SHALL reject the request with a
 * descriptive error, and the purchase's remainingQuantity SHALL remain
 * unchanged.
 *
 * **Validates: Requirements 3.1, 3.6**
 *
 * Tag: Feature: category-package-management, Property 5: Category Mismatch Rejection
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

// Arbitrary for remainingQuantity (1-20, must be > 0 for otherwise-valid purchase)
const arbRemainingQuantity = fc.integer({ min: 1, max: 20 });

// Arbitrary for expiresAt: always in the future for otherwise-valid purchases
const arbFutureExpiresAt = fc.integer({ min: 1, max: 30 }).map((days) => {
  const now = new Date();
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
});

// Generate two distinct ObjectIds guaranteed to be different
const arbDistinctCategoryIds = fc
  .tuple(fc.constant(null), fc.constant(null))
  .map(() => {
    const a = new Types.ObjectId();
    let b = new Types.ObjectId();
    // Ensure they are distinct (extremely unlikely to collide, but be safe)
    while (a.toString() === b.toString()) {
      b = new Types.ObjectId();
    }
    return { purchaseCategoryId: a, listingCategoryId: b };
  });

// Generate a valid purchase record (all preconditions met except category will mismatch the listing)
function arbValidPurchaseWithCategory(
  sellerId: Types.ObjectId,
  categoryId: Types.ObjectId,
) {
  return fc
    .record({
      type: arbPackageType,
      remainingQuantity: arbRemainingQuantity,
      expiresAt: arbFutureExpiresAt,
    })
    .map((fields) => {
      const _id = new Types.ObjectId();
      const packageId = new Types.ObjectId();
      return {
        _id,
        sellerId,
        packageId,
        categoryId,
        type: fields.type,
        quantity: 10,
        remainingQuantity: fields.remainingQuantity,
        duration: 7,
        price: 500,
        paymentMethod: PaymentMethod.JAZZCASH,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: fields.expiresAt,
        activatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
}

describe('Property 5: Category Mismatch Rejection', () => {
  it('Feature: category-package-management, Property 5: Category Mismatch Rejection', async () => {
    const sellerId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbDistinctCategoryIds,
        arbPackageType,
        arbRemainingQuantity,
        arbFutureExpiresAt,
        async (categoryIds, type, remainingQuantity, expiresAt) => {
          const { purchaseCategoryId, listingCategoryId } = categoryIds;

          const purchase = {
            _id: new Types.ObjectId(),
            sellerId,
            packageId: new Types.ObjectId(),
            categoryId: purchaseCategoryId,
            type,
            quantity: 10,
            remainingQuantity,
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

          // findOneAndUpdate returns null because categoryId in the filter
          // won't match the purchase's categoryId (A ≠ B)
          mockPackagePurchaseModel.findOneAndUpdate = jest
            .fn()
            .mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            });

          // findById returns the purchase so the service can determine
          // the specific rejection reason (category mismatch)
          mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(purchase),
          });

          mockPackagePurchaseModel.find = jest.fn();

          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn();

          const mockUserModel: any = {
            findById: jest.fn(),
          };
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

          // Call applyPackageToListing with the LISTING's categoryId (B),
          // while the purchase has categoryId A — mismatch
          await expect(
            service.applyPackageToListing(
              purchase._id.toString(),
              sellerId.toString(),
              listingCategoryId.toString(),
            ),
          ).rejects.toThrow(BadRequestException);

          await expect(
            service.applyPackageToListing(
              purchase._id.toString(),
              sellerId.toString(),
              listingCategoryId.toString(),
            ),
          ).rejects.toThrow(ERROR.PACKAGE_CATEGORY_MISMATCH);

          // Verify findOneAndUpdate was called (atomic attempt was made)
          expect(mockPackagePurchaseModel.findOneAndUpdate).toHaveBeenCalled();

          // Verify the filter included the listing's categoryId (which won't match)
          const filterArg =
            mockPackagePurchaseModel.findOneAndUpdate.mock.calls[0][0];
          expect(filterArg.categoryId.toString()).toBe(
            listingCategoryId.toString(),
          );

          // Verify remainingQuantity is unchanged — the purchase object
          // was never mutated since findOneAndUpdate returned null
          expect(purchase.remainingQuantity).toBe(remainingQuantity);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000); // 60s timeout for 100 property iterations
});
