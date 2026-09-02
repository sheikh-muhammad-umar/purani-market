import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EngagementService } from './engagement.service';
import { ContactChannel } from './engagement.types';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { ShortVideo } from '../shorts/schemas/short-video.schema';
import { Conversation } from '../messaging/schemas/conversation.schema';
import { UserActivity, UserAction } from '../ai/schemas/user-activity.schema';

describe('EngagementService', () => {
  let service: EngagementService;
  let listingModel: any;
  let shortModel: any;
  let conversationModel: any;
  let activityModel: any;

  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const shortId = new Types.ObjectId();

  /** Whatever the conversations pipeline should answer with, per call. */
  const conversationAggregate = (...results: unknown[][]) => {
    const mock = conversationModel.aggregate as jest.Mock;
    for (const result of results) {
      mock.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(result),
      });
    }
  };

  beforeEach(async () => {
    listingModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([
              { _id: listingId, viewCount: 40, favoriteCount: 6 },
            ]),
        }),
      }),
    };
    shortModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue([
              { _id: shortId, viewCount: 900, favoriteCount: 75 },
            ]),
        }),
      }),
    };
    conversationModel = { aggregate: jest.fn() };
    activityModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: getModelToken(ProductListing.name), useValue: listingModel },
        { provide: getModelToken(ShortVideo.name), useValue: shortModel },
        {
          provide: getModelToken(Conversation.name),
          useValue: conversationModel,
        },
        { provide: getModelToken(UserActivity.name), useValue: activityModel },
      ],
    }).compile();

    service = module.get(EngagementService);
  });

  describe('getListingEngagement', () => {
    it('reports the stored counters alongside the derived ones', async () => {
      // chats, then leads — the two conversation-backed pipelines, in order.
      conversationAggregate(
        [{ _id: listingId, count: 3 }],
        [{ _id: listingId, leads: 5 }],
      );
      activityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { itemId: listingId, channel: ContactChannel.CALL },
            count: 9,
          },
          {
            _id: { itemId: listingId, channel: ContactChannel.WHATSAPP },
            count: 4,
          },
        ]),
      });

      const [stats] = await service.getListingEngagement(sellerId.toString());

      expect(stats).toEqual({
        itemId: listingId.toString(),
        views: 40,
        likes: 6,
        chats: 3,
        calls: 9,
        whatsapp: 4,
        // Not 3 + 9 + 4: the same person tapping call repeatedly is one lead.
        leads: 5,
      });
    });

    it('reports zeroes for a listing nobody has engaged with', async () => {
      conversationAggregate([], []);

      const [stats] = await service.getListingEngagement(sellerId.toString());

      expect(stats).toMatchObject({
        chats: 0,
        calls: 0,
        whatsapp: 0,
        leads: 0,
      });
    });

    it('counts leads across both contact taps and opened chats, de-duplicated', async () => {
      conversationAggregate([], [{ _id: listingId, leads: 2 }]);

      const [stats] = await service.getListingEngagement(sellerId.toString());

      // The lead pipeline unions the two sources and sizes a set, so somebody who
      // messaged *and* called is counted once.
      const leadPipeline = (conversationModel.aggregate as jest.Mock).mock
        .calls[1][0] as Record<string, any>[];
      const union = leadPipeline.find((stage) => stage['$unionWith']);
      expect(union).toBeDefined();
      expect(union?.['$unionWith'].coll).toBe('user_activities');
      expect(
        leadPipeline.some(
          (stage) => stage['$group']?.identities?.$addToSet === '$identity',
        ),
      ).toBe(true);
      expect(stats.leads).toBe(2);
    });

    it('asks only for the calling seller and skips deleted listings', async () => {
      conversationAggregate([], []);

      await service.getListingEngagement(sellerId.toString());

      // Scoped in the query, so there is no path that returns another seller's
      // numbers — how many buyers are chasing a listing is commercially sensitive.
      const filter = listingModel.find.mock.calls[0][0];
      expect(filter.sellerId).toEqual(sellerId);
      expect(filter.status).toEqual({ $ne: 'deleted' });
    });

    it('does not query the other collections when the seller has no listings', async () => {
      listingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        service.getListingEngagement(sellerId.toString()),
      ).resolves.toEqual([]);
      expect(conversationModel.aggregate).not.toHaveBeenCalled();
      expect(activityModel.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('getShortsEngagement', () => {
    it('keys off shortVideoId, not the listing field', async () => {
      conversationAggregate([{ _id: shortId, count: 2 }], []);

      const [stats] = await service.getShortsEngagement(sellerId.toString());

      const chatPipeline = (conversationModel.aggregate as jest.Mock).mock
        .calls[0][0] as Record<string, any>[];
      expect(chatPipeline[0]['$match']).toHaveProperty('shortVideoId');
      expect(stats).toMatchObject({
        itemId: shortId.toString(),
        views: 900,
        likes: 75,
        chats: 2,
      });
    });

    it("counts a short's own call action as a call", async () => {
      conversationAggregate([], []);
      activityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { itemId: shortId, channel: ContactChannel.CALL },
            count: 7,
          },
        ]),
      });

      const [stats] = await service.getShortsEngagement(sellerId.toString());

      // A short has a dedicated call event with no metadata.type to read, so the
      // pipeline maps the action itself onto the channel.
      const pipeline = (activityModel.aggregate as jest.Mock).mock
        .calls[0][0] as Record<string, any>[];
      expect(pipeline[0]['$match'].action.$in).toEqual(
        expect.arrayContaining([
          UserAction.CONTACT,
          UserAction.SHORT_CALL_CLICK,
        ]),
      );
      expect(stats.calls).toBe(7);
    });
  });
});
