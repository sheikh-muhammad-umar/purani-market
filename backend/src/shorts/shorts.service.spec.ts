import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ShortsService } from './shorts.service';
import { ShortVideo } from './schemas/short-video.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { ShortsPackage } from './schemas/shorts-package.schema';
import { ShortLike } from './schemas/short-like.schema';
import {
  PackagePurchase,
  PaymentStatus,
  PurchaseType,
} from '../packages/schemas/package-purchase.schema';
import { AdPackageType } from '../packages/schemas/ad-package.schema';
import { EntitlementKind } from '../packages/entitlements';
import { PackagesService } from '../packages/packages.service';
import { ViewCounterService } from '../views/view-counter.service';
import { SearchSyncService } from '../search/search-sync.service';
import { User } from '../users/schemas/user.schema';
import { StorageService } from '../listings/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { ShortsVideoService } from './shorts-video.service';
import { ERROR } from '../common/constants/error-messages';
import { daysFromNow } from '../common/utils/time';

/**
 * Covers the paid-shorts path specifically.
 *
 * This service had no spec at all, which is how a bundle's shorts allowance came
 * to be unspendable without anything failing.
 */
describe('ShortsService — shorts entitlement', () => {
  let service: ShortsService;
  let purchaseModel: any;
  let shortVideoModel: any;
  let packagesService: any;

  const sellerId = new Types.ObjectId();
  const purchaseId = new Types.ObjectId();

  /** A dedicated shorts purchase: balance lives on the flat counter. */
  const shortsPurchase = () => ({
    _id: purchaseId,
    sellerId,
    purchaseType: PurchaseType.SHORTS,
    packageId: { name: '10 Shorts' },
    quantity: 10,
    remainingQuantity: 4,
    duration: 30,
    paymentStatus: PaymentStatus.COMPLETED,
    expiresAt: daysFromNow(20),
  });

  /**
   * A bundle: `purchaseType` is `ads` and the shorts balance lives on the
   * entitlement, while `remainingQuantity` is the total across every kind.
   */
  const bundlePurchase = (shortsRemaining = 3) => ({
    _id: purchaseId,
    sellerId,
    purchaseType: PurchaseType.ADS,
    type: AdPackageType.BUNDLE,
    packageId: { name: 'All In One' },
    quantity: 25,
    remainingQuantity: 25,
    duration: 30,
    paymentStatus: PaymentStatus.COMPLETED,
    expiresAt: daysFromNow(20),
    entitlements: [
      { kind: EntitlementKind.AD_SLOTS, quantity: 10, remaining: 10 },
      { kind: EntitlementKind.FEATURED_ADS, quantity: 10, remaining: 8 },
      {
        kind: EntitlementKind.SHORTS,
        quantity: 5,
        remaining: shortsRemaining,
      },
    ],
  });

  const uploadedFile = {
    buffer: Buffer.from('video'),
    originalname: 'clip.mp4',
    mimetype: 'video/mp4',
    size: 1024,
  } as Express.Multer.File;

  const uploadDto = { title: 'A short', description: 'Body' } as any;

  beforeEach(async () => {
    const savedShort = {
      _id: new Types.ObjectId(),
      save: jest.fn().mockResolvedValue(true),
    };
    shortVideoModel = jest.fn().mockImplementation(() => savedShort);
    shortVideoModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    purchaseModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    packagesService = {
      // Real filter shape is exercised by the packages specs; here it only needs
      // to be the thing that gets called, so the query is not re-implemented.
      entitlementFilter: jest
        .fn()
        .mockReturnValue({ sellerId, __filter: 'shared' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShortsService,
        { provide: getModelToken(ShortVideo.name), useValue: shortVideoModel },
        {
          provide: getModelToken(ShortsPackage.name),
          useValue: { find: jest.fn(), findById: jest.fn() },
        },
        {
          provide: getModelToken(PackagePurchase.name),
          useValue: purchaseModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: { findById: jest.fn() },
        },
        {
          // Read-only, for the linked-listing ownership check.
          provide: getModelToken(ProductListing.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
              }),
            }),
          },
        },
        {
          provide: getModelToken(ShortLike.name),
          useValue: { find: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: {
            saveFile: jest.fn().mockResolvedValue({ fileUrl: '/f.mp4' }),
          },
        },
        {
          provide: NotificationsService,
          useValue: { sendToUser: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: AdminTrackerService,
          useValue: { track: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ShortsVideoService,
          useValue: {
            processShortVideo: jest.fn().mockResolvedValue({
              compressedBuffer: Buffer.from('c'),
              thumbnailBuffer: Buffer.from('t'),
              duration: 30,
              width: 720,
              height: 1280,
            }),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PackagesService, useValue: packagesService },
        {
          provide: ViewCounterService,
          useValue: { shouldCountView: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: SearchSyncService,
          useValue: {
            indexShort: jest.fn().mockResolvedValue(undefined),
            removeShort: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ShortsService);
  });

  describe('getUsableShortsPackages', () => {
    it('includes a bundle and reports its shorts balance, not the bundle total', async () => {
      // The regression this exists for: filtering on `purchaseType: 'shorts'`
      // hid every bundle, so the shorts allowance an all-in-one package
      // advertised could not be selected at upload time.
      purchaseModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([bundlePurchase(3)]),
          }),
        }),
      });

      const usable = await service.getUsableShortsPackages(sellerId.toString());

      expect(usable).toEqual([
        {
          purchaseId: purchaseId.toString(),
          packageName: 'All In One',
          // 3, not the bundle's remainingQuantity of 25.
          remaining: 3,
          expiresAt: expect.any(Date),
          durationDays: 30,
        },
      ]);
    });

    it('asks for shorts credit through the shared entitlement filter', async () => {
      await service.getUsableShortsPackages(sellerId.toString());

      // Reused rather than copied, so the two shapes stay in step with the
      // packages side.
      expect(packagesService.entitlementFilter).toHaveBeenCalledWith(
        sellerId.toString(),
        EntitlementKind.SHORTS,
        expect.any(Date),
      );
      expect(purchaseModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ __filter: 'shared' }),
      );
    });

    it('orders soonest-expiring first so credit about to lapse is offered', async () => {
      const sort = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      purchaseModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({ sort }),
      });

      await service.getUsableShortsPackages(sellerId.toString());

      expect(sort).toHaveBeenCalledWith({ expiresAt: 1 });
    });
  });

  describe('createShort with a purchase', () => {
    it('spends a bundle from its entitlement rather than the flat counter', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(bundlePurchase(3)),
      });
      // The flat branch is scoped to `purchaseType: 'shorts'`, so it cannot match
      // a bundle — which matters, because a bundle's remainingQuantity is the
      // total across kinds and would otherwise be double-spendable.
      purchaseModel.updateOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      });

      await service.createShort(sellerId.toString(), uploadedFile, {
        ...uploadDto,
        purchaseId: purchaseId.toString(),
      });

      expect(purchaseModel.updateOne).toHaveBeenCalledTimes(2);
      const [entitlementFilter, update, options] =
        purchaseModel.updateOne.mock.calls[1];
      expect(entitlementFilter).toEqual(
        expect.objectContaining({
          _id: purchaseId,
          entitlements: {
            $elemMatch: {
              kind: EntitlementKind.SHORTS,
              remaining: { $gt: 0 },
            },
          },
        }),
      );
      expect(update).toEqual({
        $inc: { 'entitlements.$[slot].remaining': -1 },
      });
      expect(options.arrayFilters).toEqual([
        { 'slot.kind': EntitlementKind.SHORTS, 'slot.remaining': { $gt: 0 } },
      ]);
    });

    it('spends a dedicated shorts purchase from the flat counter', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(shortsPurchase()),
      });

      await service.createShort(sellerId.toString(), uploadedFile, {
        ...uploadDto,
        purchaseId: purchaseId.toString(),
      });

      // Matched on the first try, so the entitlement branch is never reached.
      expect(purchaseModel.updateOne).toHaveBeenCalledTimes(1);
      expect(purchaseModel.updateOne).toHaveBeenCalledWith(
        {
          _id: purchaseId,
          purchaseType: PurchaseType.SHORTS,
          remainingQuantity: { $gt: 0 },
        },
        { $inc: { remainingQuantity: -1 } },
      );
    });

    it('refuses a bundle whose shorts allowance is used up', async () => {
      // Ad slots and featured credit remain, so a check on remainingQuantity
      // would have let this through and handed out a free short.
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(bundlePurchase(0)),
      });

      await expect(
        service.createShort(sellerId.toString(), uploadedFile, {
          ...uploadDto,
          purchaseId: purchaseId.toString(),
        }),
      ).rejects.toThrow(
        new BadRequestException(ERROR.SHORT_PACKAGE_FULLY_USED),
      );
      expect(purchaseModel.updateOne).not.toHaveBeenCalled();
    });

    it('refuses an expired purchase', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...shortsPurchase(),
          expiresAt: daysFromNow(-1),
        }),
      });

      await expect(
        service.createShort(sellerId.toString(), uploadedFile, {
          ...uploadDto,
          purchaseId: purchaseId.toString(),
        }),
      ).rejects.toThrow(new BadRequestException(ERROR.SHORT_PACKAGE_EXPIRED));
    });

    it("refuses another seller's purchase", async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...shortsPurchase(),
          sellerId: new Types.ObjectId(),
        }),
      });

      await expect(
        service.createShort(sellerId.toString(), uploadedFile, {
          ...uploadDto,
          purchaseId: purchaseId.toString(),
        }),
      ).rejects.toThrow(new BadRequestException(ERROR.PACKAGE_OWN_ONLY));
    });

    it('refuses a purchase whose payment has not completed', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...shortsPurchase(),
          paymentStatus: PaymentStatus.PENDING,
        }),
      });

      await expect(
        service.createShort(sellerId.toString(), uploadedFile, {
          ...uploadDto,
          purchaseId: purchaseId.toString(),
        }),
      ).rejects.toThrow(
        new BadRequestException(ERROR.PACKAGE_PAYMENT_NOT_COMPLETED),
      );
    });
  });

  describe('confirmPayment', () => {
    it('starts the duration at confirmation, not at purchase', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ ...shortsPurchase(), duration: 30 }),
      });

      await service.confirmPayment(purchaseId.toString());

      // Stamped at purchase before, so a package confirmed three days later
      // arrived with three days already burnt.
      const [filter, update] = purchaseModel.updateOne.mock.calls[0];
      expect(filter).toEqual({
        _id: purchaseId,
        paymentStatus: PaymentStatus.PENDING,
      });
      const expiresAt = update.$set.expiresAt as Date;
      const activatedAt = update.$set.activatedAt as Date;
      expect(update.$set.paymentStatus).toBe(PaymentStatus.COMPLETED);
      expect(
        Math.round((expiresAt.getTime() - activatedAt.getTime()) / 86400000),
      ).toBe(30);
    });

    it('refuses to confirm a purchase that is no longer pending', async () => {
      purchaseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(shortsPurchase()),
      });
      // Nothing matched the PENDING-scoped update, so another admin or an earlier
      // click already dealt with it. Confirming again would restart the duration.
      purchaseModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      });

      await expect(
        service.confirmPayment(purchaseId.toString()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleExpiredShortsPurchases', () => {
    const expiredWith = (rows: Record<string, unknown>[]) => {
      purchaseModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(rows),
        }),
      });
    };

    it('notifies about a bundle and counts only the shorts lost', async () => {
      // Bundles were skipped entirely, and the count came off remainingQuantity —
      // the total across every kind — so it would have claimed 25 shorts lost.
      expiredWith([bundlePurchase(2)]);

      await expect(service.handleExpiredShortsPurchases()).resolves.toBe(1);

      const notify = (service as any).notificationsService.sendToUser;
      expect(notify).toHaveBeenCalledWith(
        sellerId.toString(),
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('2 unused short(s)'),
        }),
      );
    });

    it('matches on holding shorts credit in either shape', async () => {
      expiredWith([]);

      await service.handleExpiredShortsPurchases();

      const filter = purchaseModel.find.mock.calls[0][0];
      expect(filter.$or).toEqual([
        { entitlements: { $elemMatch: { kind: EntitlementKind.SHORTS } } },
        { purchaseType: PurchaseType.SHORTS },
      ]);
      // Its own marker: on a bundle, remainingQuantity belongs to the ad-slot
      // sweep, which runs at the same hour.
      expect(filter.shortsExpiryNotifiedAt).toBeNull();
    });

    it('claims a purchase before notifying so a duplicate run stays quiet', async () => {
      expiredWith([shortsPurchase()]);
      purchaseModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      });

      await expect(service.handleExpiredShortsPurchases()).resolves.toBe(0);
      expect(
        (service as any).notificationsService.sendToUser,
      ).not.toHaveBeenCalled();
    });

    it('stays quiet when the allowance was fully spent', async () => {
      // Expiring with nothing left is not news.
      expiredWith([bundlePurchase(0)]);

      await service.handleExpiredShortsPurchases();

      expect(
        (service as any).notificationsService.sendToUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe('createShort without a purchase', () => {
    it('uses the free monthly allowance and spends nothing', async () => {
      await service.createShort(sellerId.toString(), uploadedFile, uploadDto);

      expect(purchaseModel.updateOne).not.toHaveBeenCalled();
      expect(shortVideoModel).toHaveBeenCalledWith(
        expect.objectContaining({ isPaid: false, purchaseId: undefined }),
      );
    });

    it('refuses once the free monthly allowance is used up', async () => {
      shortVideoModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(99),
      });

      await expect(
        service.createShort(sellerId.toString(), uploadedFile, uploadDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
