/**
 * Property 8: Event CategoryId Completeness
 *
 * For any package-related event recorded in UserActivity (actions matching
 * package_apply_success, package_apply_failed, package_expired,
 * packaged_listing_deleted, packaged_listing_deactivated, packaged_listing_sold),
 * the event's metadata SHALL include a non-null categoryId field.
 *
 * **Validates: Requirements 9.34**
 *
 * Tag: Feature: category-package-management, Property 8: Event CategoryId Completeness
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Types } from 'mongoose';
import { PackagesService } from './packages.service';
import { AdPackage, AdPackageType } from './schemas/ad-package.schema';
import {
  PackagePurchase,
  PaymentMethod,
  PaymentStatus,
} from './schemas/package-purchase.schema';
import { User } from '../users/schemas/user.schema';
import {
  ProductListing,
  ListingStatus,
} from '../listings/schemas/product-listing.schema';
import { PaymentsService } from '../payments/payments.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { ListingsService } from '../listings/listings.service';
import { Category } from '../categories/schemas/category.schema';
import { AllowedStatusTransition } from '../listings/dto/update-status.dto';
import { SearchSyncService } from '../search/search-sync.service';
import { BrandsService } from '../brands/brands.service';
import { VehicleBrandService } from '../brands/vehicle-brand.service';
import { VehicleModelService } from '../brands/vehicle-model.service';
import { VehicleVariantService } from '../brands/vehicle-variant.service';
import { UserAction } from '../ai/enums/user-action.enum';
import { ConfigService } from '@nestjs/config';

// The six package-related event actions we must verify
const PACKAGE_EVENT_ACTIONS = [
  UserAction.PACKAGE_APPLY_SUCCESS,
  UserAction.PACKAGE_APPLY_FAILED,
  UserAction.PACKAGE_EXPIRED,
  UserAction.PACKAGED_LISTING_DELETED,
  UserAction.PACKAGED_LISTING_DEACTIVATED,
  UserAction.PACKAGED_LISTING_SOLD,
];

// Arbitrary for package type
const arbPackageType = fc.constantFrom(
  AdPackageType.FEATURED_ADS,
  AdPackageType.AD_SLOTS,
);

// Arbitrary for failure reason
const arbFailureReason = fc.constantFrom(
  'category_mismatch',
  'payment_not_completed',
  'fully_used',
  'expired',
);

// Arbitrary for remaining quantity (valid: > 0)
const arbRemainingQuantity = fc.integer({ min: 1, max: 20 });

// Arbitrary for future expiry
const arbFutureExpiresAt = fc.integer({ min: 1, max: 30 }).map((days) => {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
});

describe('Property 8: Event CategoryId Completeness', () => {
  /**
   * Test PACKAGE_APPLY_SUCCESS: When applyPackageToListing succeeds,
   * the tracked event metadata must include a non-null categoryId.
   */
  it('Feature: category-package-management, Property 8: Event CategoryId Completeness — PACKAGE_APPLY_SUCCESS', async () => {
    const sellerId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(
        arbPackageType,
        arbRemainingQuantity,
        arbFutureExpiresAt,
        async (packageType, remainingQuantity, expiresAt) => {
          const categoryId = new Types.ObjectId();
          const purchaseId = new Types.ObjectId();
          const packageId = new Types.ObjectId();

          const trackCalls: Array<{
            action: string;
            metadata: Record<string, any>;
          }> = [];
          const mockAdminTracker = {
            track: jest.fn().mockImplementation((_userId, action, metadata) => {
              trackCalls.push({ action, metadata });
              return Promise.resolve();
            }),
          };

          const updatedPurchase = {
            _id: purchaseId,
            sellerId,
            packageId,
            categoryId,
            type: packageType,
            remainingQuantity: remainingQuantity - 1,
            populate: jest.fn().mockResolvedValue({
              _id: purchaseId,
              sellerId,
              packageId: {
                _id: packageId,
                name: 'Test Pkg',
                type: packageType,
              },
              categoryId,
              type: packageType,
              remainingQuantity: remainingQuantity - 1,
              expiresAt,
            }),
          };

          const mockPackagePurchaseModel: any = jest.fn();
          mockPackagePurchaseModel.findOneAndUpdate = jest
            .fn()
            .mockReturnValue({
              exec: jest.fn().mockResolvedValue(updatedPurchase),
            });
          mockPackagePurchaseModel.findById = jest.fn();
          mockPackagePurchaseModel.find = jest.fn();

          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn();

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
                useValue: { findById: jest.fn() },
              },
              {
                provide: getModelToken(ProductListing.name),
                useValue: {
                  findById: jest.fn(),
                  find: jest.fn(),
                  updateMany: jest.fn(),
                },
              },
              { provide: PaymentsService, useValue: {} },
              { provide: AdminTrackerService, useValue: mockAdminTracker },
            ],
          }).compile();

          const service = module.get<PackagesService>(PackagesService);
          await service.applyPackageToListing(
            purchaseId.toString(),
            sellerId.toString(),
            categoryId.toString(),
          );

          // Find the PACKAGE_APPLY_SUCCESS event
          const successEvent = trackCalls.find(
            (c) => c.action === UserAction.PACKAGE_APPLY_SUCCESS,
          );
          expect(successEvent).toBeDefined();
          expect(successEvent!.metadata.categoryId).toBeDefined();
          expect(successEvent!.metadata.categoryId).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Test PACKAGE_APPLY_FAILED: When applyPackageToListing fails,
   * the tracked event metadata must include a non-null categoryId.
   */
  it('Feature: category-package-management, Property 8: Event CategoryId Completeness — PACKAGE_APPLY_FAILED', async () => {
    const sellerId = new Types.ObjectId();

    await fc.assert(
      fc.asyncProperty(arbFailureReason, async (reason) => {
        const categoryId = new Types.ObjectId();
        const purchaseId = new Types.ObjectId();

        const trackCalls: Array<{
          action: string;
          metadata: Record<string, any>;
        }> = [];
        const mockAdminTracker = {
          track: jest.fn().mockImplementation((_userId, action, metadata) => {
            trackCalls.push({ action, metadata });
            return Promise.resolve();
          }),
        };

        // Build a purchase that will fail for the given reason
        const mockPurchase: any = {
          _id: purchaseId,
          sellerId,
          packageId: new Types.ObjectId(),
          categoryId:
            reason === 'category_mismatch' ? new Types.ObjectId() : categoryId,
          type: AdPackageType.FEATURED_ADS,
          quantity: 10,
          remainingQuantity: reason === 'fully_used' ? 0 : 5,
          duration: 7,
          price: 500,
          paymentMethod: PaymentMethod.JAZZCASH,
          paymentStatus:
            reason === 'payment_not_completed'
              ? PaymentStatus.PENDING
              : PaymentStatus.COMPLETED,
          expiresAt:
            reason === 'expired'
              ? new Date(Date.now() - 1000)
              : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        const mockPackagePurchaseModel: any = jest.fn();
        // Atomic update returns null (failure path)
        mockPackagePurchaseModel.findOneAndUpdate = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });
        mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPurchase),
        });
        mockPackagePurchaseModel.find = jest.fn();

        const mockAdPackageModel: any = jest.fn();
        mockAdPackageModel.find = jest.fn();
        mockAdPackageModel.findById = jest.fn();

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
              useValue: { findById: jest.fn() },
            },
            {
              provide: getModelToken(ProductListing.name),
              useValue: {
                findById: jest.fn(),
                find: jest.fn(),
                updateMany: jest.fn(),
              },
            },
            { provide: PaymentsService, useValue: {} },
            { provide: AdminTrackerService, useValue: mockAdminTracker },
          ],
        }).compile();

        const service = module.get<PackagesService>(PackagesService);

        try {
          await service.applyPackageToListing(
            purchaseId.toString(),
            sellerId.toString(),
            categoryId.toString(),
          );
        } catch {
          // Expected to throw
        }

        // Find the PACKAGE_APPLY_FAILED event
        const failEvent = trackCalls.find(
          (c) => c.action === UserAction.PACKAGE_APPLY_FAILED,
        );
        expect(failEvent).toBeDefined();
        expect(failEvent!.metadata.categoryId).toBeDefined();
        expect(failEvent!.metadata.categoryId).not.toBeNull();
      }),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Test PACKAGE_EXPIRED: When handleExpiredFeaturedAds runs,
   * the tracked event metadata must include a non-null categoryId.
   */
  it('Feature: category-package-management, Property 8: Event CategoryId Completeness — PACKAGE_EXPIRED', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPackageType,
        arbRemainingQuantity,
        async (packageType, remainingQuantity) => {
          const sellerId = new Types.ObjectId();
          const categoryId = new Types.ObjectId();
          const purchaseId = new Types.ObjectId();
          const listingId = new Types.ObjectId();

          const trackCalls: Array<{
            action: string;
            metadata: Record<string, any>;
          }> = [];
          const mockAdminTracker = {
            track: jest.fn().mockImplementation((_userId, action, metadata) => {
              trackCalls.push({ action, metadata });
              return Promise.resolve();
            }),
          };

          // Expired listing with purchaseId
          const expiredListing = {
            _id: listingId,
            sellerId,
            categoryId,
            purchaseId,
            isFeatured: true,
            featuredUntil: new Date(Date.now() - 1000),
          };

          const mockPurchase = {
            _id: purchaseId,
            sellerId,
            categoryId,
            type: packageType,
            remainingQuantity,
            packageId: { _id: new Types.ObjectId(), type: packageType },
          };

          const mockListingModel: any = {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([expiredListing]),
              }),
            }),
            updateMany: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            }),
          };

          const mockPackagePurchaseModel: any = jest.fn();
          mockPackagePurchaseModel.findById = jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockPurchase),
            }),
          });
          mockPackagePurchaseModel.find = jest.fn();
          mockPackagePurchaseModel.findOneAndUpdate = jest.fn();

          const mockAdPackageModel: any = jest.fn();
          mockAdPackageModel.find = jest.fn();
          mockAdPackageModel.findById = jest.fn();

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
              { provide: getModelToken(User.name), useValue: {} },
              {
                provide: getModelToken(ProductListing.name),
                useValue: mockListingModel,
              },
              { provide: PaymentsService, useValue: {} },
              { provide: AdminTrackerService, useValue: mockAdminTracker },
            ],
          }).compile();

          const service = module.get<PackagesService>(PackagesService);
          await service.handleExpiredFeaturedAds();

          // Find the PACKAGE_EXPIRED event
          const expiredEvent = trackCalls.find(
            (c) => c.action === UserAction.PACKAGE_EXPIRED,
          );
          expect(expiredEvent).toBeDefined();
          expect(expiredEvent!.metadata.categoryId).toBeDefined();
          expect(expiredEvent!.metadata.categoryId).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Test PACKAGED_LISTING_DELETED, PACKAGED_LISTING_DEACTIVATED, PACKAGED_LISTING_SOLD:
   * When a listing with a package is deleted/deactivated/sold,
   * the tracked event metadata must include a non-null categoryId.
   */
  it('Feature: category-package-management, Property 8: Event CategoryId Completeness — Listing lifecycle events', async () => {
    const sellerId = new Types.ObjectId();

    const arbTransition = fc.constantFrom(
      'deleted' as const,
      'deactivated' as const,
      'sold' as const,
    );

    await fc.assert(
      fc.asyncProperty(
        arbTransition,
        arbPackageType,
        arbRemainingQuantity,
        async (transition, packageType, remainingQuantity) => {
          const categoryId = new Types.ObjectId();
          const purchaseId = new Types.ObjectId();
          const listingId = new Types.ObjectId();

          const trackCalls: Array<{
            action: string;
            metadata: Record<string, any>;
          }> = [];
          const mockAdminTracker = {
            track: jest.fn().mockImplementation((_userId, action, metadata) => {
              trackCalls.push({ action, metadata });
              return Promise.resolve();
            }),
          };

          const mockListing = {
            _id: listingId,
            sellerId,
            categoryId,
            purchaseId,
            title: 'Test',
            description: 'Test',
            price: { amount: 1000, currency: 'PKR' },
            status: ListingStatus.ACTIVE,
            isFeatured: false,
            viewCount: 0,
            favoriteCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const mockPurchase = {
            _id: purchaseId,
            sellerId,
            categoryId,
            type: packageType,
            remainingQuantity,
          };

          const transitionedListing = {
            ...mockListing,
            status:
              transition === 'deleted'
                ? ListingStatus.DELETED
                : transition === 'deactivated'
                  ? ListingStatus.INACTIVE
                  : ListingStatus.SOLD,
            updatedAt: new Date(),
          };

          const mockListingModel: any = jest.fn();
          mockListingModel.findById = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockListing),
          });
          mockListingModel.findByIdAndUpdate = jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(transitionedListing),
          });

          const mockUserModel: any = {
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: sellerId,
                email: 'test@test.com',
                role: 'seller',
                adLimit: 10,
                activeAdCount: 1,
              }),
            }),
            updateOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
            }),
          };

          const mockRedis: any = {
            set: jest.fn().mockResolvedValue(null),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
          };

          const mockPackagesService = {
            applyPackageToListing: jest.fn(),
            findPurchaseById: jest.fn().mockResolvedValue(mockPurchase),
          };

          const module: TestingModule = await Test.createTestingModule({
            providers: [
              ListingsService,
              {
                provide: getModelToken(ProductListing.name),
                useValue: mockListingModel,
              },
              { provide: getModelToken(User.name), useValue: mockUserModel },
              {
                provide: getModelToken(Category.name),
                useValue: { findById: jest.fn() },
              },
              { provide: getModelToken('Conversation'), useValue: {} },
              { provide: getModelToken('Message'), useValue: {} },
              {
                provide: SearchSyncService,
                useValue: { indexListing: jest.fn(), removeListing: jest.fn() },
              },
              { provide: getRedisConnectionToken(), useValue: mockRedis },
              { provide: BrandsService, useValue: { findById: jest.fn() } },
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
              { provide: PackagesService, useValue: mockPackagesService },
              { provide: AdminTrackerService, useValue: mockAdminTracker },
              {
                provide: ConfigService,
                useValue: {
                  get: jest.fn((key: string) => {
                    const config: Record<string, any> = {
                      'listing.activeDays': 30,
                    };
                    return config[key];
                  }),
                },
              },
            ],
          }).compile();

          const service = module.get<ListingsService>(ListingsService);

          if (transition === 'deleted') {
            await service.softDelete(
              listingId.toString(),
              sellerId.toString(),
              'seller',
            );
          } else if (transition === 'deactivated') {
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

          // Wait for async tracking to complete
          await new Promise((resolve) => setTimeout(resolve, 50));

          const expectedAction =
            transition === 'deleted'
              ? UserAction.PACKAGED_LISTING_DELETED
              : transition === 'deactivated'
                ? UserAction.PACKAGED_LISTING_DEACTIVATED
                : UserAction.PACKAGED_LISTING_SOLD;

          const event = trackCalls.find((c) => c.action === expectedAction);
          expect(event).toBeDefined();
          expect(event!.metadata.categoryId).toBeDefined();
          expect(event!.metadata.categoryId).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);
});
