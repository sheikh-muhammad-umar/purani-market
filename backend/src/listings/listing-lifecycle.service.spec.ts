import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { ListingLifecycleService } from './listing-lifecycle.service';
import {
  ProductListing,
  ListingStatus,
} from './schemas/product-listing.schema';
import { User } from '../users/schemas/user.schema';
import { PackagePurchase } from '../packages/schemas/package-purchase.schema';
import { Favorite } from '../favorites/schemas/favorite.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { SearchSyncService } from '../search/search-sync.service';
import { PackagesService } from '../packages/packages.service';
import { LISTING_LIMIT_GRACE_DAYS } from '../common/constants';
import { daysToMs } from '../common/utils/time';

describe('ListingLifecycleService — listing limit enforcement', () => {
  let service: ListingLifecycleService;
  let listingModel: any;
  let userModel: any;
  let notifications: any;

  const sellerId = new Types.ObjectId();

  /** Sellers the over-limit query should return. */
  const stubOverLimit = (rows: Record<string, unknown>[]) => {
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(rows),
      }),
    });
  };

  /** Listings the enforcement step would pick, oldest first. */
  const stubCandidates = (rows: Record<string, unknown>[]) => {
    listingModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    });
  };

  beforeEach(async () => {
    listingModel = {
      find: jest.fn(),
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      }),
    };
    userModel = {
      find: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn() }),
    };
    notifications = {
      sendListingLimitExceededWarning: jest.fn().mockResolvedValue(true),
      sendListingsDeactivatedForLimitNotification: jest
        .fn()
        .mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingLifecycleService,
        { provide: getModelToken(ProductListing.name), useValue: listingModel },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(PackagePurchase.name),
          useValue: {
            find: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
          },
        },
        {
          provide: getModelToken(Favorite.name),
          useValue: { deleteMany: jest.fn() },
        },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: AdminTrackerService,
          useValue: { track: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SearchSyncService,
          useValue: { removeListing: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PackagesService,
          useValue: { reconcileListingLimit: jest.fn().mockResolvedValue(10) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'listing.activeDays': 30,
                'listing.deactivatedCleanupDays': 7,
                'listing.defaultListingLimit': 10,
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get(ListingLifecycleService);
  });

  it('warns on first detection instead of deactivating', async () => {
    // Ad slots expire under listings that are still running, so a seller can go
    // over their limit through nothing they did. Pulling ads immediately would
    // take their shopfront down with no warning.
    stubOverLimit([
      {
        _id: sellerId,
        activeListingCount: 14,
        listingLimit: 10,
        overLimitSince: null,
      },
    ]);

    const deactivated = await service.enforceListingLimits();

    expect(deactivated).toBe(0);
    expect(notifications.sendListingLimitExceededWarning).toHaveBeenCalledWith(
      sellerId.toString(),
      14,
      10,
      LISTING_LIMIT_GRACE_DAYS,
    );
    // The clock starts now; nothing is touched yet.
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: sellerId },
      { $set: { overLimitSince: expect.any(Date) } },
    );
    expect(listingModel.updateMany).not.toHaveBeenCalled();
  });

  it('leaves a seller alone while they are still inside the grace period', async () => {
    stubOverLimit([
      {
        _id: sellerId,
        activeListingCount: 12,
        listingLimit: 10,
        overLimitSince: new Date(Date.now() - daysToMs(1)),
      },
    ]);

    await expect(service.enforceListingLimits()).resolves.toBe(0);
    expect(listingModel.updateMany).not.toHaveBeenCalled();
    expect(
      notifications.sendListingLimitExceededWarning,
    ).not.toHaveBeenCalled();
  });

  it('deactivates the excess once the grace period has passed', async () => {
    const oldest = new Types.ObjectId();
    const nextOldest = new Types.ObjectId();
    stubOverLimit([
      {
        _id: sellerId,
        activeListingCount: 12,
        listingLimit: 10,
        overLimitSince: new Date(
          Date.now() - daysToMs(LISTING_LIMIT_GRACE_DAYS + 1),
        ),
      },
    ]);
    stubCandidates([
      { _id: oldest, title: 'Oldest ad' },
      { _id: nextOldest, title: 'Next oldest' },
    ]);

    const deactivated = await service.enforceListingLimits();

    expect(deactivated).toBe(2);
    // Deactivated, not deleted, so the seller can bring them back.
    expect(listingModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [oldest, nextOldest] } },
      expect.objectContaining({
        $set: expect.objectContaining({ status: ListingStatus.INACTIVE }),
      }),
    );
    // Count corrected and the marker cleared in one write.
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: sellerId },
      {
        $inc: { activeListingCount: -2 },
        $set: { overLimitSince: null },
      },
    );
    expect(
      notifications.sendListingsDeactivatedForLimitNotification,
    ).toHaveBeenCalledWith(sellerId.toString(), 2, 10);
  });

  it('never deactivates a featured listing', async () => {
    stubOverLimit([
      {
        _id: sellerId,
        activeListingCount: 12,
        listingLimit: 10,
        overLimitSince: new Date(
          Date.now() - daysToMs(LISTING_LIMIT_GRACE_DAYS + 1),
        ),
      },
    ]);
    stubCandidates([]);

    // Promotion that has been paid for keeps running; the condition resolves
    // when it ends rather than by retracting it.
    await expect(service.enforceListingLimits()).resolves.toBe(0);
    expect(listingModel.updateMany).not.toHaveBeenCalled();

    const candidateFilter = listingModel.find.mock.calls[0][0];
    expect(candidateFilter.status).toBe(ListingStatus.ACTIVE);
    expect(candidateFilter.$or).toEqual([
      { isFeatured: false },
      { isFeatured: { $exists: false } },
    ]);
  });

  it('takes the oldest first', async () => {
    stubOverLimit([
      {
        _id: sellerId,
        activeListingCount: 11,
        listingLimit: 10,
        overLimitSince: new Date(
          Date.now() - daysToMs(LISTING_LIMIT_GRACE_DAYS + 1),
        ),
      },
    ]);
    const sort = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([{ _id: new Types.ObjectId(), title: 'x' }]),
        }),
      }),
    });
    listingModel.find.mockReturnValue({ sort });

    await service.enforceListingLimits();

    // Oldest have had the most exposure already.
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
  });

  it('clears the marker for sellers who came back within their limit', async () => {
    stubOverLimit([]);

    await service.enforceListingLimits();

    // So a later breach starts a fresh grace period rather than inheriting a
    // stale one and being enforced immediately.
    expect(userModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ overLimitSince: { $ne: null } }),
      { $set: { overLimitSince: null } },
    );
  });
});
