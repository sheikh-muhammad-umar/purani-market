import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdvertisingService } from './advertising.service.js';
import {
  AdCampaignStatus,
  AdDevice,
  AdEventType,
  AdPlacement,
} from './advertising.enums.js';
import { Advertiser } from './schemas/advertiser.schema.js';
import { AdCampaign } from './schemas/ad-campaign.schema.js';
import { AdCreative } from './schemas/ad-creative.schema.js';
import { AdEvent } from './schemas/ad-event.schema.js';
import { Category } from '../categories/schemas/category.schema.js';

/** Resolves through an `.exec()` chain. */
const execOf = (value: unknown) => ({
  exec: jest.fn().mockResolvedValue(value),
});
/** Resolves through a `.lean().exec()` chain. */
const leanOf = (value: unknown) => ({ lean: () => execOf(value) });
/** Resolves through a `.select().lean().exec()` chain. */
const selectLeanOf = (value: unknown) => ({ select: () => leanOf(value) });
/** Resolves through a `.sort().exec()` chain. */
const sortOf = (value: unknown) => ({ sort: () => execOf(value) });

describe('AdvertisingService', () => {
  let service: AdvertisingService;
  let advertiserModel: any;
  let campaignModel: any;
  let creativeModel: any;
  let eventModel: any;
  let categoryModel: any;

  const advertiserId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const creativeId = new Types.ObjectId();
  const parentCategoryId = new Types.ObjectId();
  const childCategoryId = new Types.ObjectId();

  const activeCampaign = (overrides: Record<string, any> = {}) => ({
    _id: campaignId,
    advertiserId,
    name: 'Spring push',
    status: AdCampaignStatus.ACTIVE,
    startAt: new Date(Date.now() - 1000),
    endAt: new Date(Date.now() + 100000),
    priority: 5,
    maxImpressions: 0,
    maxClicks: 0,
    dailyImpressionCap: 0,
    targeting: {
      placements: [AdPlacement.SEARCH_TOP],
      categoryIds: [],
      provinceIds: [],
      cityIds: [],
      devices: [],
    },
    metrics: { impressions: 0, clicks: 0 },
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const creative = (overrides: Record<string, any> = {}) => ({
    _id: creativeId,
    campaignId,
    placement: AdPlacement.SEARCH_TOP,
    title: 'Big Brand Sale',
    imageUrl: 'https://cdn.example.com/a.png',
    altText: 'Big Brand Sale',
    destinationUrl: 'https://brand.example.com',
    weight: 1,
    isActive: true,
    metrics: { impressions: 0, clicks: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    advertiserModel = {
      find: jest.fn().mockReturnValue(sortOf([])),
      findById: jest
        .fn()
        .mockReturnValue(execOf({ _id: advertiserId, name: 'Brand' })),
      create: jest
        .fn()
        .mockImplementation((dto: any) => ({ _id: advertiserId, ...dto })),
      countDocuments: jest.fn().mockReturnValue(execOf(0)),
      deleteOne: jest.fn().mockReturnValue(execOf({ deletedCount: 1 })),
    };
    advertiserModel.find.mockImplementation(() => ({
      ...sortOf([]),
      select: () => leanOf([{ _id: advertiserId, name: 'Brand' }]),
    }));

    campaignModel = {
      find: jest.fn().mockReturnValue(execOf([])),
      findById: jest.fn().mockReturnValue(execOf(activeCampaign())),
      create: jest
        .fn()
        .mockImplementation((dto: any) => ({ _id: campaignId, ...dto })),
      countDocuments: jest.fn().mockReturnValue(execOf(0)),
      deleteOne: jest.fn().mockReturnValue(execOf({ deletedCount: 1 })),
      deleteMany: jest.fn().mockReturnValue(execOf({ deletedCount: 0 })),
      updateOne: jest.fn().mockReturnValue(execOf({ modifiedCount: 1 })),
      updateMany: jest.fn().mockReturnValue(execOf({ modifiedCount: 0 })),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    creativeModel = {
      find: jest.fn().mockReturnValue(leanOf([])),
      findById: jest.fn().mockReturnValue(execOf(creative())),
      create: jest
        .fn()
        .mockImplementation((dto: any) => ({ _id: creativeId, ...dto })),
      deleteOne: jest.fn().mockReturnValue(execOf({ deletedCount: 1 })),
      deleteMany: jest.fn().mockReturnValue(execOf({ deletedCount: 2 })),
      updateOne: jest.fn().mockReturnValue(execOf({ modifiedCount: 1 })),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    eventModel = {
      create: jest.fn().mockResolvedValue({}),
      exists: jest.fn().mockReturnValue(execOf(null)),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    categoryModel = {
      findById: jest.fn().mockReturnValue(leanOf(null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvertisingService,
        { provide: getModelToken(Advertiser.name), useValue: advertiserModel },
        { provide: getModelToken(AdCampaign.name), useValue: campaignModel },
        { provide: getModelToken(AdCreative.name), useValue: creativeModel },
        { provide: getModelToken(AdEvent.name), useValue: eventModel },
        { provide: getModelToken(Category.name), useValue: categoryModel },
      ],
    }).compile();

    service = module.get<AdvertisingService>(AdvertisingService);
  });

  // ── Serving ───────────────────────────────────────────────────────

  describe('serve', () => {
    it('returns nothing when no campaign is eligible', async () => {
      const ads = await service.serve({ placement: AdPlacement.SEARCH_TOP });
      expect(ads).toEqual([]);
    });

    it('filters on status, schedule window and placement', async () => {
      await service.serve({ placement: AdPlacement.SEARCH_TOP });

      const filter = campaignModel.find.mock.calls[0][0];
      expect(filter.status).toBe(AdCampaignStatus.ACTIVE);
      expect(filter['targeting.placements']).toBe(AdPlacement.SEARCH_TOP);
      expect(filter.startAt.$lte).toBeInstanceOf(Date);
      expect(filter.endAt.$gte).toBeInstanceOf(Date);
    });

    it('returns nothing when an eligible campaign has no creative for the slot', async () => {
      campaignModel.find.mockReturnValue(execOf([activeCampaign()]));
      creativeModel.find.mockReturnValue(leanOf([]));

      const ads = await service.serve({ placement: AdPlacement.SEARCH_TOP });
      expect(ads).toEqual([]);
    });

    it('serves an eligible creative with its advertiser name', async () => {
      campaignModel.find.mockReturnValue(execOf([activeCampaign()]));
      creativeModel.find.mockReturnValue(leanOf([creative()]));

      const ads = await service.serve({ placement: AdPlacement.SEARCH_TOP });

      expect(ads).toHaveLength(1);
      expect(ads[0]).toMatchObject({
        creativeId: creativeId.toString(),
        campaignId: campaignId.toString(),
        title: 'Big Brand Sale',
        destinationUrl: 'https://brand.example.com',
        advertiserName: 'Brand',
      });
    });

    it('only allows unrestricted campaigns when the visitor has no category', async () => {
      await service.serve({ placement: AdPlacement.SEARCH_TOP });

      const filter = campaignModel.find.mock.calls[0][0];
      expect(filter['targeting.categoryIds']).toEqual({ $size: 0 });
    });

    it('matches a campaign that targets an ancestor of the browsed category', async () => {
      // child -> parent chain
      categoryModel.findById
        .mockReturnValueOnce(
          leanOf({ _id: childCategoryId, parentId: parentCategoryId }),
        )
        .mockReturnValueOnce(leanOf({ _id: parentCategoryId, parentId: null }));

      await service.serve({
        placement: AdPlacement.SEARCH_TOP,
        categoryId: childCategoryId.toString(),
      });

      const filter = campaignModel.find.mock.calls[0][0];
      const categoryClause = filter.$and.find(
        (clause: any) => clause.$or?.[0]?.['targeting.categoryIds'],
      );
      const lineage = categoryClause.$or[1]['targeting.categoryIds'].$in;
      expect(lineage.map(String)).toEqual([
        childCategoryId.toString(),
        parentCategoryId.toString(),
      ]);
    });

    it('honours a device restriction', async () => {
      await service.serve({
        placement: AdPlacement.SEARCH_TOP,
        device: AdDevice.MOBILE,
      });

      const filter = campaignModel.find.mock.calls[0][0];
      const deviceClause = filter.$and.find(
        (clause: any) => clause.$or?.[0]?.['targeting.devices'],
      );
      expect(deviceClause.$or[1]['targeting.devices']).toBe(AdDevice.MOBILE);
    });

    it('excludes a campaign that reached its lifetime impression cap', async () => {
      campaignModel.find.mockReturnValue(
        execOf([
          activeCampaign({
            maxImpressions: 100,
            metrics: { impressions: 100, clicks: 0 },
          }),
        ]),
      );

      const ads = await service.serve({ placement: AdPlacement.SEARCH_TOP });
      expect(ads).toEqual([]);
      expect(creativeModel.find).not.toHaveBeenCalled();
    });

    it('excludes a campaign that reached its lifetime click cap', async () => {
      campaignModel.find.mockReturnValue(
        execOf([
          activeCampaign({
            maxClicks: 10,
            metrics: { impressions: 5, clicks: 10 },
          }),
        ]),
      );

      expect(
        await service.serve({ placement: AdPlacement.SEARCH_TOP }),
      ).toEqual([]);
    });

    it('excludes a campaign that reached its daily impression cap', async () => {
      campaignModel.find.mockReturnValue(
        execOf([activeCampaign({ dailyImpressionCap: 50 })]),
      );
      eventModel.aggregate.mockResolvedValue([{ _id: campaignId, count: 50 }]);

      expect(
        await service.serve({ placement: AdPlacement.SEARCH_TOP }),
      ).toEqual([]);
    });

    it('still serves a campaign under its daily cap', async () => {
      campaignModel.find.mockReturnValue(
        execOf([activeCampaign({ dailyImpressionCap: 50 })]),
      );
      eventModel.aggregate.mockResolvedValue([{ _id: campaignId, count: 49 }]);
      creativeModel.find.mockReturnValue(leanOf([creative()]));

      expect(
        await service.serve({ placement: AdPlacement.SEARCH_TOP }),
      ).toHaveLength(1);
    });

    it('weights selection by creative weight and campaign priority', async () => {
      const heavyId = new Types.ObjectId();
      campaignModel.find.mockReturnValue(execOf([activeCampaign()]));
      creativeModel.find.mockReturnValue(
        leanOf([
          creative({ _id: creativeId, weight: 1 }),
          creative({ _id: heavyId, weight: 99 }),
        ]),
      );

      // Land the cursor past the first (weight 1*5) and into the second (99*5).
      (service as any).randomFloat = jest.fn().mockReturnValue(0.9);

      const ads = await service.serve({ placement: AdPlacement.SEARCH_TOP });
      expect(ads[0].creativeId).toBe(heavyId.toString());
    });

    it('returns distinct creatives when several are requested', async () => {
      const secondId = new Types.ObjectId();
      campaignModel.find.mockReturnValue(execOf([activeCampaign()]));
      creativeModel.find.mockReturnValue(
        leanOf([creative({ _id: creativeId }), creative({ _id: secondId })]),
      );

      const ads = await service.serve({
        placement: AdPlacement.SEARCH_TOP,
        limit: 2,
      });

      expect(ads).toHaveLength(2);
      expect(new Set(ads.map((ad) => ad.creativeId)).size).toBe(2);
    });
  });

  // ── Tracking ──────────────────────────────────────────────────────

  describe('recordEvent', () => {
    it('records an impression and increments both counters', async () => {
      const result = await service.recordEvent(creativeId.toString(), {
        type: AdEventType.IMPRESSION,
        placement: AdPlacement.SEARCH_TOP,
      });

      expect(result).toEqual({ recorded: true });
      expect(eventModel.create).toHaveBeenCalled();
      expect(creativeModel.updateOne).toHaveBeenCalledWith(
        { _id: creativeId },
        { $inc: { 'metrics.impressions': 1 } },
      );
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: campaignId },
        { $inc: { 'metrics.impressions': 1 } },
      );
    });

    it('ignores a repeat impression from the same session', async () => {
      eventModel.exists.mockReturnValue(execOf({ _id: new Types.ObjectId() }));

      const result = await service.recordEvent(creativeId.toString(), {
        type: AdEventType.IMPRESSION,
        placement: AdPlacement.SEARCH_TOP,
        sessionId: 'session-1',
      });

      expect(result).toEqual({ recorded: false });
      expect(eventModel.create).not.toHaveBeenCalled();
      expect(creativeModel.updateOne).not.toHaveBeenCalled();
    });

    it('records a repeat click, since it is a real second visit', async () => {
      eventModel.exists.mockReturnValue(execOf({ _id: new Types.ObjectId() }));

      const result = await service.recordEvent(creativeId.toString(), {
        type: AdEventType.CLICK,
        placement: AdPlacement.SEARCH_TOP,
        sessionId: 'session-1',
      });

      expect(result).toEqual({ recorded: true });
      expect(campaignModel.updateOne).toHaveBeenCalledWith(
        { _id: campaignId },
        { $inc: { 'metrics.clicks': 1 } },
      );
    });

    it('completes the campaign as soon as a cap is reached', async () => {
      const campaign = activeCampaign({
        maxImpressions: 10,
        metrics: { impressions: 10, clicks: 0 },
      });
      campaignModel.findById.mockReturnValue(execOf(campaign));

      await service.recordEvent(creativeId.toString(), {
        type: AdEventType.IMPRESSION,
        placement: AdPlacement.SEARCH_TOP,
      });

      expect(campaign.status).toBe(AdCampaignStatus.COMPLETED);
      expect(campaign.save).toHaveBeenCalled();
    });

    it('rejects an invalid creative id', async () => {
      await expect(
        service.recordEvent('not-an-id', {
          type: AdEventType.CLICK,
          placement: AdPlacement.SEARCH_TOP,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown creative', async () => {
      creativeModel.findById.mockReturnValue(execOf(null));
      await expect(
        service.recordEvent(creativeId.toString(), {
          type: AdEventType.CLICK,
          placement: AdPlacement.SEARCH_TOP,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Scheduling ────────────────────────────────────────────────────

  describe('syncCampaignStatuses', () => {
    it('activates due campaigns and completes expired ones', async () => {
      campaignModel.updateMany
        .mockReturnValueOnce(execOf({ modifiedCount: 2 }))
        .mockReturnValueOnce(execOf({ modifiedCount: 3 }));

      const result = await service.syncCampaignStatuses();

      expect(result).toEqual({ activated: 2, completed: 3 });
      const activateFilter = campaignModel.updateMany.mock.calls[0][0];
      expect(activateFilter.status).toBe(AdCampaignStatus.SCHEDULED);
      const completeFilter = campaignModel.updateMany.mock.calls[1][0];
      expect(completeFilter.endAt.$lt).toBeInstanceOf(Date);
    });
  });

  // ── Campaign and creative invariants ──────────────────────────────

  describe('createCampaign', () => {
    const baseDto = {
      advertiserId: advertiserId.toString(),
      name: 'Launch',
      startAt: new Date(Date.now() + 1000).toISOString(),
      endAt: new Date(Date.now() + 100000).toISOString(),
      targeting: { placements: [AdPlacement.SEARCH_TOP] },
    };

    it('rejects a window that ends before it starts', async () => {
      await expect(
        service.createCampaign({
          ...baseDto,
          startAt: new Date(Date.now() + 100000).toISOString(),
          endAt: new Date(Date.now() + 1000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown advertiser', async () => {
      advertiserModel.findById.mockReturnValue(execOf(null));
      await expect(service.createCampaign(baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('normalises targeting ids and defaults the empty dimensions', async () => {
      await service.createCampaign({
        ...baseDto,
        targeting: {
          placements: [AdPlacement.SEARCH_TOP],
          categoryIds: [parentCategoryId.toString(), 'not-an-id'],
        },
      });

      const created = campaignModel.create.mock.calls[0][0];
      expect(created.targeting.categoryIds.map(String)).toEqual([
        parentCategoryId.toString(),
      ]);
      expect(created.targeting.devices).toEqual([]);
    });
  });

  describe('createCreative', () => {
    const baseDto = {
      campaignId: campaignId.toString(),
      placement: AdPlacement.SEARCH_TOP,
      title: 'Sale',
      imageUrl: 'https://cdn.example.com/a.png',
      altText: 'Sale',
    };

    it('requires exactly one destination', async () => {
      await expect(service.createCreative({ ...baseDto })).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        service.createCreative({
          ...baseDto,
          destinationUrl: 'https://brand.example.com',
          routeLink: '/search',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a placement the campaign did not buy', async () => {
      await expect(
        service.createCreative({
          ...baseDto,
          placement: AdPlacement.SHORTS_FEED,
          destinationUrl: 'https://brand.example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a valid creative', async () => {
      const created = await service.createCreative({
        ...baseDto,
        destinationUrl: 'https://brand.example.com',
      });
      expect(created).toMatchObject({ title: 'Sale' });
    });
  });

  describe('deletion guards', () => {
    it('refuses to delete an advertiser that still has campaigns', async () => {
      campaignModel.countDocuments.mockReturnValue(execOf(2));
      await expect(
        service.deleteAdvertiser(advertiserId.toString()),
      ).rejects.toThrow(BadRequestException);
      expect(advertiserModel.deleteOne).not.toHaveBeenCalled();
    });

    it('deletes an advertiser with no campaigns', async () => {
      await service.deleteAdvertiser(advertiserId.toString());
      expect(advertiserModel.deleteOne).toHaveBeenCalledWith({
        _id: advertiserId,
      });
    });

    it('removes a campaign together with its creatives', async () => {
      await service.deleteCampaign(campaignId.toString());
      expect(creativeModel.deleteMany).toHaveBeenCalledWith({
        campaignId,
      });
      expect(campaignModel.deleteOne).toHaveBeenCalledWith({ _id: campaignId });
    });
  });

  // ── Reporting ─────────────────────────────────────────────────────

  describe('getPerformance', () => {
    it('aggregates totals and computes CTR as a percentage', async () => {
      eventModel.aggregate
        .mockResolvedValueOnce([
          { _id: campaignId, impressions: 200, clicks: 10 },
        ])
        .mockResolvedValueOnce([
          { _id: creativeId, impressions: 200, clicks: 10 },
        ])
        .mockResolvedValueOnce([
          { _id: '2026-08-01', impressions: 200, clicks: 10 },
        ]);
      campaignModel.find.mockReturnValue(
        selectLeanOf([{ _id: campaignId, name: 'Spring push' }]),
      );
      creativeModel.find.mockReturnValue(
        selectLeanOf([{ _id: creativeId, title: 'Big Brand Sale' }]),
      );

      const report = await service.getPerformance();

      expect(report.totals).toEqual({ impressions: 200, clicks: 10, ctr: 5 });
      expect(report.campaigns[0]).toMatchObject({
        name: 'Spring push',
        impressions: 200,
        ctr: 5,
      });
      expect(report.creatives[0]).toMatchObject({ name: 'Big Brand Sale' });
      expect(report.daily).toEqual([
        { date: '2026-08-01', impressions: 200, clicks: 10 },
      ]);
    });

    it('reports zero CTR rather than dividing by zero', async () => {
      eventModel.aggregate
        .mockResolvedValueOnce([{ _id: campaignId, impressions: 0, clicks: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      campaignModel.find.mockReturnValue(selectLeanOf([]));

      const report = await service.getPerformance();
      expect(report.totals.ctr).toBe(0);
    });

    it('rejects an unparseable date range', async () => {
      await expect(service.getPerformance('nonsense')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
