/**
 * Property 1: Price Resolution Correctness
 *
 * For any AdPackage with a categoryPricing array and for any categoryId,
 * the resolved purchase price SHALL equal the price from the matching
 * categoryPricing entry if one exists, otherwise it SHALL equal the defaultPrice.
 *
 * **Validates: Requirements 1.2, 1.3**
 *
 * Tag: Feature: category-package-management, Property 1: Price Resolution Correctness
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

// Arbitrary for AdPackageType
const arbPackageType = fc.constantFrom(
  AdPackageType.FEATURED_ADS,
  AdPackageType.AD_SLOTS,
);

// Arbitrary for a price value (positive integer)
const arbPrice = fc.integer({ min: 1, max: 10000 });

// Arbitrary for a category pricing entry
const arbCategoryPricingEntry = fc.record({
  categoryId: fc.constant(null).map(() => new Types.ObjectId()),
  price: arbPrice,
});

// Generate a random AdPackage with 0-5 categoryPricing entries and a defaultPrice
function arbAdPackage() {
  return fc
    .record({
      type: arbPackageType,
      defaultPrice: arbPrice,
      categoryPricing: fc.array(arbCategoryPricingEntry, {
        minLength: 0,
        maxLength: 5,
      }),
    })
    .map((fields) => {
      const _id = new Types.ObjectId();
      return {
        _id,
        name: 'Test Package',
        type: fields.type,
        duration: 7 as const,
        quantity: 10,
        defaultPrice: fields.defaultPrice,
        categoryPricing: fields.categoryPricing,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
}

// Generate a categoryId that may or may not match one of the categoryPricing entries
function arbCategoryId(
  categoryPricing: { categoryId: Types.ObjectId; price: number }[],
) {
  if (categoryPricing.length === 0) {
    // No entries — always generate a non-matching categoryId
    return fc.constant(new Types.ObjectId());
  }
  // ~50% chance of matching an existing entry, ~50% chance of a new random one
  return fc.oneof(
    fc.constantFrom(...categoryPricing.map((cp) => cp.categoryId)),
    fc.constant(null).map(() => new Types.ObjectId()),
  );
}

describe('Property 1: Price Resolution Correctness', () => {
  it('Feature: category-package-management, Property 1: Price Resolution Correctness', async () => {
    const sellerId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbAdPackage().chain((pkg) =>
          arbCategoryId(pkg.categoryPricing).map((catId) => ({
            pkg,
            categoryId: catId,
          })),
        ),
        async ({ pkg, categoryId }) => {
          // Compute expected price
          const matchingEntry = pkg.categoryPricing.find(
            (cp) => cp.categoryId.toString() === categoryId.toString(),
          );
          const expectedPrice = matchingEntry
            ? matchingEntry.price
            : pkg.defaultPrice;

          // Mock AdPackage.findById to return the generated package
          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(pkg),
          });

          // Capture the price stored on the created PackagePurchase
          let capturedPrice: number | undefined;
          const mockSavedPurchase = {
            _id: new Types.ObjectId(),
            sellerId,
            packageId: pkg._id,
            categoryId,
            type: pkg.type,
            quantity: pkg.quantity,
            remainingQuantity: pkg.quantity,
            duration: pkg.duration,
            price: 0, // will be set by constructor
            paymentMethod: PaymentMethod.JAZZCASH,
            paymentStatus: PaymentStatus.PENDING,
            save: jest.fn(),
          };

          const mockPackagePurchaseModel: any = jest
            .fn()
            .mockImplementation((data: any) => {
              capturedPrice = data.price;
              mockSavedPurchase.price = data.price;
              return {
                ...mockSavedPurchase,
                save: jest.fn().mockResolvedValue({
                  ...mockSavedPurchase,
                  price: data.price,
                }),
              };
            });

          mockPackagePurchaseModel.find = jest.fn();
          mockPackagePurchaseModel.findById = jest.fn();
          mockPackagePurchaseModel.findOneAndUpdate = jest.fn();
          mockPackagePurchaseModel.updateMany = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          });

          const mockUserModel: any = {
            findById: jest.fn(),
          };
          const mockListingModel: any = {
            findById: jest.fn(),
            updateMany: jest.fn(),
          };
          const mockPaymentsService: any = {
            initiatePayment: jest.fn().mockResolvedValue({
              redirectUrl: 'https://pay.example.com',
              transactionId: 'txn_123',
            }),
          };

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

          await service.purchasePackages(sellerId.toString(), {
            items: [
              {
                packageId: pkg._id.toString(),
                categoryId: categoryId.toString(),
              },
            ],
            paymentMethod: PaymentMethod.JAZZCASH,
          });

          // Property assertion: the price stored on the purchase matches expected
          expect(capturedPrice).toBe(expectedPrice);

          // Also verify the payment amount passed to initiatePayment
          const paymentCall = mockPaymentsService.initiatePayment.mock.calls[0];
          const paymentArgs = paymentCall[1];
          expect(paymentArgs.amount).toBe(expectedPrice);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000); // 60s timeout for 100 property iterations
});
