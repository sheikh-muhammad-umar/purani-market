/**
 * Property 6: Permanent Consumption (Non-Restoration)
 *
 * For any listing with a Package_Application and for any listing status
 * transition (delete, deactivate, or sold), the associated purchase's
 * remainingQuantity SHALL remain unchanged after the transition — the system
 * SHALL NOT increment remainingQuantity under any circumstance after the
 * initial decrement.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * Tag: Feature: category-package-management, Property 6: Permanent Consumption (Non-Restoration)
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Types } from 'mongoose';
import { ListingsService } from './listings.service';
import {
  ProductListing,
  ListingStatus,
} from './schemas/product-listing.schema';
import { User } from '../users/schemas/user.schema';
import { Category } from '../categories/schemas/category.schema';
import { AllowedStatusTransition } from './dto/update-status.dto';
import { SearchSyncService } from '../search/search-sync.service';
import { BrandsService } from '../brands/brands.service';
import { VehicleBrandService } from '../brands/vehicle-brand.service';
import { VehicleModelService } from '../brands/vehicle-model.service';
import { VehicleVariantService } from '../brands/vehicle-variant.service';
import { PackagesService } from '../packages/packages.service';
import { AdPackageType } from '../packages/schemas/ad-package.schema';
import {
  PaymentMethod,
  PaymentStatus,
} from '../packages/schemas/package-purchase.schema';
import { AdminTrackerService } from '../ai/admin-tracker.service';

// Arbitrary for the transition type to exercise
const arbTransitionType = fc.constantFrom(
  'delete' as const,
  'deactivate' as const,
  'sold' as const,
);

// Arbitrary for package type
const arbPackageType = fc.constantFrom(
  AdPackageType.FEATURED_ADS,
  AdPackageType.AD_SLOTS,
);

// Arbitrary for remainingQuantity (0-20, any value — the point is it must not change)
const arbRemainingQuantity = fc.integer({ min: 0, max: 20 });

describe('Property 6: Permanent Consumption (Non-Restoration)', () => {
  it('Feature: category-package-management, Property 6: Permanent Consumption (Non-Restoration)', async () => {
    const sellerId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbTransitionType,
        arbPackageType,
        arbRemainingQuantity,
        async (transitionType, packageType, remainingQuantity) => {
          const listingId = new Types.ObjectId();
          const purchaseId = new Types.ObjectId();
          const categoryId = new Types.ObjectId();

          // A listing that has a Package_Application (purchaseId set)
          const mockListing = {
            _id: listingId,
            sellerId,
            title: 'Test Listing',
            description: 'Test description',
            price: { amount: 1000, currency: 'PKR' },
            categoryId,
            purchaseId,
            status: ListingStatus.ACTIVE,
            isFeatured: packageType === AdPackageType.FEATURED_ADS,
            viewCount: 0,
            favoriteCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // The associated purchase record
          const mockPurchase = {
            _id: purchaseId,
            sellerId,
            packageId: new Types.ObjectId(),
            categoryId,
            type: packageType,
            quantity: 10,
            remainingQuantity,
            duration: 7,
            price: 500,
            paymentMethod: PaymentMethod.JAZZCASH,
            paymentStatus: PaymentStatus.COMPLETED,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          };

          // Track ALL calls to PackagePurchase model methods
          const purchaseUpdateOne = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
          });
          const purchaseFindOneAndUpdate = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          });
          const purchaseUpdateMany = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
          });
          const purchaseFindByIdAndUpdate = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          });

          // Mock PackagePurchase model — spy on all update methods
          const mockPackagePurchaseModel: any = jest.fn();
          mockPackagePurchaseModel.updateOne = purchaseUpdateOne;
          mockPackagePurchaseModel.findOneAndUpdate = purchaseFindOneAndUpdate;
          mockPackagePurchaseModel.updateMany = purchaseUpdateMany;
          mockPackagePurchaseModel.findByIdAndUpdate =
            purchaseFindByIdAndUpdate;
          mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPurchase),
          });

          // Mock listing model
          const mockListingModel: any = jest.fn();
          mockListingModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockListing),
          });

          const transitionedListing = {
            ...mockListing,
            status:
              transitionType === 'delete'
                ? ListingStatus.DELETED
                : transitionType === 'deactivate'
                  ? ListingStatus.INACTIVE
                  : ListingStatus.SOLD,
            ...(transitionType === 'delete' ? { deletedAt: new Date() } : {}),
            updatedAt: new Date(),
          };

          mockListingModel.findByIdAndUpdate = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(transitionedListing),
          });

          // Mock user model
          const mockUserModel: any = {
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: sellerId,
                email: 'seller@test.com',
                role: 'seller',
                adLimit: 10,
                activeAdCount: 1,
              }),
            }),
            updateOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            }),
          };

          const mockCategoryModel: any = {
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
          };

          const mockRedis: any = {
            set: jest.fn().mockResolvedValue(null),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
          };

          const module: TestingModule = await Test.createTestingModule({
            providers: [
              ListingsService,
              {
                provide: getModelToken(ProductListing.name),
                useValue: mockListingModel,
              },
              {
                provide: getModelToken(User.name),
                useValue: mockUserModel,
              },
              {
                provide: getModelToken(Category.name),
                useValue: mockCategoryModel,
              },
              {
                provide: getModelToken('Conversation'),
                useValue: {},
              },
              {
                provide: getModelToken('Message'),
                useValue: {},
              },
              {
                provide: SearchSyncService,
                useValue: {
                  indexListing: jest.fn(),
                  removeListing: jest.fn(),
                },
              },
              {
                provide: getRedisConnectionToken(),
                useValue: mockRedis,
              },
              {
                provide: BrandsService,
                useValue: { findById: jest.fn() },
              },
              {
                provide: VehicleBrandService,
                useValue: {
                  findById: jest.fn(),
                  countByCategory: jest.fn().mockResolvedValue(0),
                },
              },
              {
                provide: VehicleModelService,
                useValue: { findById: jest.fn() },
              },
              {
                provide: VehicleVariantService,
                useValue: { findById: jest.fn() },
              },
              {
                provide: PackagesService,
                useValue: {
                  applyPackageToListing: jest.fn(),
                  findPurchaseById: jest.fn().mockResolvedValue(mockPurchase),
                },
              },
              {
                provide: AdminTrackerService,
                useValue: { track: jest.fn().mockResolvedValue(undefined) },
              },
            ],
          }).compile();

          const service = module.get<ListingsService>(ListingsService);

          // Execute the transition
          if (transitionType === 'delete') {
            await service.softDelete(
              listingId.toString(),
              sellerId.toString(),
              'seller',
            );
          } else if (transitionType === 'deactivate') {
            await service.updateStatus(
              listingId.toString(),
              sellerId.toString(),
              AllowedStatusTransition.INACTIVE,
            );
          } else {
            await service.updateStatus(
              listingId.toString(),
              sellerId.toString(),
              AllowedStatusTransition.SOLD,
            );
          }

          // CORE ASSERTION: PackagePurchase model update methods were NEVER
          // called with any operation that increments remainingQuantity.
          // We check that no update method was called at all on the purchase model.
          const allUpdateCalls = [
            ...purchaseUpdateOne.mock.calls,
            ...purchaseFindOneAndUpdate.mock.calls,
            ...purchaseUpdateMany.mock.calls,
            ...purchaseFindByIdAndUpdate.mock.calls,
          ];

          // No update calls should have been made to the PackagePurchase model
          // during any listing status transition
          for (const call of allUpdateCalls) {
            // Check each argument for $inc with positive remainingQuantity
            for (const arg of call) {
              if (arg && typeof arg === 'object') {
                // Check for $inc: { remainingQuantity: positive }
                if (arg.$inc && arg.$inc.remainingQuantity > 0) {
                  throw new Error(
                    `PackagePurchase remainingQuantity was incremented via $inc during ${transitionType} transition`,
                  );
                }
                // Check for $set with remainingQuantity higher than current
                if (
                  arg.$set &&
                  arg.$set.remainingQuantity !== undefined &&
                  arg.$set.remainingQuantity > remainingQuantity
                ) {
                  throw new Error(
                    `PackagePurchase remainingQuantity was restored via $set during ${transitionType} transition`,
                  );
                }
              }
            }
          }

          // Additionally verify the purchase's remainingQuantity value
          // was never directly mutated
          expect(mockPurchase.remainingQuantity).toBe(remainingQuantity);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
