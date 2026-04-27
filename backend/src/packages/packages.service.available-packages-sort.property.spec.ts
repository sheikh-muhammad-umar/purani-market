/**
 * Property 3: Available Packages Sort Order
 *
 * For any result set returned by getAvailablePackages, the purchases SHALL
 * be sorted by expiresAt in ascending order so that the soonest-expiring
 * package appears first.
 *
 * **Validates: Requirements 7.3**
 *
 * Tag: Feature: category-package-management, Property 3: Available Packages Sort Order
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

// Generate a valid/available purchase (completed, qty > 0, future expiry)
// with a random expiresAt in the future
function arbAvailablePurchase(
  sellerId: Types.ObjectId,
  categoryId: Types.ObjectId,
) {
  return fc
    .record({
      // Random future offset: 1 minute to 90 days
      futureOffsetMs: fc.integer({
        min: 60_000,
        max: 90 * 24 * 60 * 60 * 1000,
      }),
      remainingQuantity: fc.integer({ min: 1, max: 20 }),
      type: fc.constantFrom(AdPackageType.FEATURED_ADS, AdPackageType.AD_SLOTS),
    })
    .map((fields) => {
      const now = new Date();
      return {
        _id: new Types.ObjectId(),
        sellerId,
        packageId: new Types.ObjectId(),
        categoryId,
        type: fields.type,
        quantity: 10,
        remainingQuantity: fields.remainingQuantity,
        duration: 7,
        price: 500,
        paymentMethod: PaymentMethod.JAZZCASH,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: new Date(now.getTime() + fields.futureOffsetMs),
        activatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
}

describe('Property 3: Available Packages Sort Order', () => {
  it('Feature: category-package-management, Property 3: Available Packages Sort Order', async () => {
    const sellerId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbAvailablePurchase(sellerId, categoryId), {
          minLength: 2,
          maxLength: 30,
        }),
        async (purchases) => {
          // Build mock that simulates find().sort().populate().exec()
          // The mock captures the sort argument and applies it to the filtered results
          const mockPackagePurchaseModel: any = jest
            .fn()
            .mockImplementation(() => ({}));

          mockPackagePurchaseModel.find = jest
            .fn()
            .mockImplementation((query: any) => {
              // All generated purchases are valid/available, so filter passes them all
              const filtered = purchases.filter((p) => {
                if (
                  query.sellerId &&
                  p.sellerId.toString() !== query.sellerId.toString()
                )
                  return false;
                if (
                  query.categoryId &&
                  p.categoryId.toString() !== query.categoryId.toString()
                )
                  return false;
                if (
                  query.paymentStatus &&
                  p.paymentStatus !== query.paymentStatus
                )
                  return false;
                if (
                  query.remainingQuantity &&
                  query.remainingQuantity.$gt !== undefined &&
                  p.remainingQuantity <= query.remainingQuantity.$gt
                )
                  return false;
                if (
                  query.expiresAt &&
                  query.expiresAt.$gt &&
                  p.expiresAt <= query.expiresAt.$gt
                )
                  return false;
                return true;
              });

              return {
                sort: jest.fn().mockImplementation((sortSpec: any) => {
                  // Apply the sort spec to the filtered results
                  const sorted = [...filtered].sort((a, b) => {
                    for (const key of Object.keys(sortSpec)) {
                      const dir = sortSpec[key]; // 1 = asc, -1 = desc
                      const aRec = a as Record<string, any>;
                      const bRec = b as Record<string, any>;
                      const aVal =
                        aRec[key] instanceof Date
                          ? aRec[key].getTime()
                          : aRec[key];
                      const bVal =
                        bRec[key] instanceof Date
                          ? bRec[key].getTime()
                          : bRec[key];
                      if (aVal < bVal) return -1 * dir;
                      if (aVal > bVal) return 1 * dir;
                    }
                    return 0;
                  });
                  return {
                    populate: jest.fn().mockReturnValue({
                      exec: jest.fn().mockResolvedValue(sorted),
                    }),
                  };
                }),
              };
            });

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

          const result = await service.getAvailablePackages(
            sellerId.toString(),
            categoryId.toString(),
          );

          // Property assertion: result is sorted by expiresAt ascending
          for (let i = 1; i < result.length; i++) {
            const prev = (result[i - 1] as any).expiresAt.getTime();
            const curr = (result[i] as any).expiresAt.getTime();
            expect(prev).toBeLessThanOrEqual(curr);
          }

          // Verify the sort mock was called with { expiresAt: 1 }
          const findCall = mockPackagePurchaseModel.find.mock.results[0].value;
          expect(findCall.sort).toHaveBeenCalledWith({ expiresAt: 1 });
        },
      ),
      { numRuns: 100 },
    );
  }, 60000); // 60s timeout for 100 property iterations
});
