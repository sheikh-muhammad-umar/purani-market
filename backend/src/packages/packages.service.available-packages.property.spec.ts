/**
 * Property 2: Available Packages Filter Correctness
 *
 * For any set of PackagePurchase records belonging to a seller,
 * getAvailablePackages(sellerId, categoryId) SHALL return exactly those
 * purchases where categoryId matches the requested category, paymentStatus
 * is "completed", remainingQuantity is greater than zero, and expiresAt is
 * in the future — and no others.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Tag: Feature: category-package-management, Property 2: Available Packages Filter Correctness
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
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
import { AdminTrackerService } from '../ai/admin-tracker.service';

// Arbitrary for PaymentStatus
const arbPaymentStatus = fc.constantFrom(
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
);

// Arbitrary for AdPackageType
const arbPackageType = fc.constantFrom(
  AdPackageType.FEATURED_ADS,
  AdPackageType.AD_SLOTS,
);

// Arbitrary for remainingQuantity (0 to 20)
const arbRemainingQuantity = fc.integer({ min: 0, max: 20 });

// Arbitrary for expiresAt: either in the past or in the future
const arbExpiresAt = fc.boolean().map((isFuture) => {
  const now = new Date();
  if (isFuture) {
    // 1 hour to 30 days in the future
    const offset =
      Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000) + 3600000;
    return new Date(now.getTime() + offset);
  } else {
    // 1 hour to 30 days in the past
    const offset =
      Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000) + 3600000;
    return new Date(now.getTime() - offset);
  }
});

// Generate a purchase record with controlled properties
function arbPurchaseRecord(
  sellerId: Types.ObjectId,
  categoryIds: Types.ObjectId[],
) {
  return fc
    .record({
      paymentStatus: arbPaymentStatus,
      remainingQuantity: arbRemainingQuantity,
      expiresAt: arbExpiresAt,
      categoryId: fc.constantFrom(...categoryIds),
      type: arbPackageType,
    })
    .map((fields) => {
      const _id = new Types.ObjectId();
      const packageId = new Types.ObjectId();
      return {
        _id,
        sellerId,
        packageId,
        categoryId: fields.categoryId,
        type: fields.type,
        quantity: 10,
        remainingQuantity: fields.remainingQuantity,
        duration: 7,
        price: 500,
        paymentMethod: PaymentMethod.JAZZCASH,
        paymentStatus: fields.paymentStatus,
        expiresAt: fields.expiresAt,
        activatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
}

describe('Property 2: Available Packages Filter Correctness', () => {
  it('Feature: category-package-management, Property 2: Available Packages Filter Correctness', async () => {
    const sellerId = new Types.ObjectId();
    // Use 3 distinct category IDs to ensure meaningful filtering
    const categoryIds = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];
    const targetCategoryId = categoryIds[0];

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbPurchaseRecord(sellerId, categoryIds), {
          minLength: 1,
          maxLength: 30,
        }),
        async (purchases) => {
          const now = new Date();

          // Compute expected results: purchases that match ALL four criteria
          const expected = purchases.filter(
            (p) =>
              p.categoryId.toString() === targetCategoryId.toString() &&
              p.paymentStatus === PaymentStatus.COMPLETED &&
              p.remainingQuantity > 0 &&
              p.expiresAt > now,
          );
          const expectedIds = new Set(expected.map((p) => p._id.toString()));

          // Build mock model that simulates Mongoose's find().sort().populate().exec() chain
          // The mock captures the query filter and applies it to the purchases array
          // to simulate what MongoDB would return
          const mockPackagePurchaseModel: any = jest
            .fn()
            .mockImplementation(() => ({}));

          mockPackagePurchaseModel.find = jest
            .fn()
            .mockImplementation((query: any) => {
              // Apply the query filter to our purchases array, simulating MongoDB behavior
              const filtered = purchases.filter((p) => {
                // sellerId match
                if (
                  query.sellerId &&
                  p.sellerId.toString() !== query.sellerId.toString()
                )
                  return false;
                // categoryId match
                if (
                  query.categoryId &&
                  p.categoryId.toString() !== query.categoryId.toString()
                )
                  return false;
                // paymentStatus match
                if (
                  query.paymentStatus &&
                  p.paymentStatus !== query.paymentStatus
                )
                  return false;
                // remainingQuantity: { $gt: 0 }
                if (
                  query.remainingQuantity &&
                  query.remainingQuantity.$gt !== undefined &&
                  p.remainingQuantity <= query.remainingQuantity.$gt
                )
                  return false;
                // expiresAt: { $gt: now }
                if (
                  query.expiresAt &&
                  query.expiresAt.$gt &&
                  p.expiresAt <= query.expiresAt.$gt
                )
                  return false;
                return true;
              });

              return {
                sort: jest.fn().mockReturnValue({
                  populate: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue(filtered),
                  }),
                }),
              };
            });

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

          const result = await service.getAvailablePackages(
            sellerId.toString(),
            targetCategoryId.toString(),
          );

          // Property assertion: result set matches expected set exactly
          const resultIds = new Set(result.map((p: any) => p._id.toString()));

          // Same size
          expect(resultIds.size).toBe(expectedIds.size);

          // Same elements
          for (const id of expectedIds) {
            expect(resultIds.has(id)).toBe(true);
          }
          for (const id of resultIds) {
            expect(expectedIds.has(id)).toBe(true);
          }

          // Additional: no result should violate any filter criterion
          for (const r of result) {
            expect(r.categoryId!.toString()).toBe(targetCategoryId.toString());
            expect(r.paymentStatus).toBe(PaymentStatus.COMPLETED);
            expect(r.remainingQuantity).toBeGreaterThan(0);
            expect(r.expiresAt!.getTime()).toBeGreaterThan(now.getTime());
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60000); // 60s timeout for 100 property iterations
});
