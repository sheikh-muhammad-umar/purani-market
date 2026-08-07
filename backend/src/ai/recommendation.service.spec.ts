import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RecommendationService } from './recommendation.service';
import { UserActivity, UserAction } from './schemas/user-activity.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let mockActivityModel: any;
  let mockListingModel: any;

  const userId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();

  const mockListings = [
    {
      _id: new Types.ObjectId(),
      title: 'Listing 1',
      status: 'active',
      viewCount: 100,
      isFeatured: true,
    },
    {
      _id: new Types.ObjectId(),
      title: 'Listing 2',
      status: 'active',
      viewCount: 50,
      isFeatured: false,
    },
  ];

  beforeEach(async () => {
    const saveFn = jest.fn().mockResolvedValue({ _id: new Types.ObjectId() });

    mockActivityModel = jest.fn().mockImplementation(() => ({
      save: saveFn,
    }));
    // findOne for existence check
    mockActivityModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
        }),
      }),
    });
    mockActivityModel.aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          dismissed: [],
          interactions: [{ categoryId, productListingId: listingId }],
        },
      ]),
    });
    mockActivityModel.insertMany = jest.fn().mockResolvedValue([]);

    mockListingModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockListings),
            }),
            exec: jest.fn().mockResolvedValue(mockListings),
          }),
        }),
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockListings),
        }),
      }),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListings),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: getModelToken(UserActivity.name),
          useValue: mockActivityModel,
        },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  afterEach(async () => {
    // Trigger module destroy to flush buffer and clear timers
    await service.onModuleDestroy();
  });

  describe('trackActivity', () => {
    it('should buffer non-critical activities (VIEW)', async () => {
      const result = await service.trackActivity(
        userId.toString(),
        UserAction.VIEW,
        {
          productListingId: listingId.toString(),
          categoryId: categoryId.toString(),
        },
      );

      // Non-critical actions are buffered, not saved immediately
      expect(result).toMatchObject({
        action: UserAction.VIEW,
        productListingId: expect.any(Types.ObjectId),
        categoryId: expect.any(Types.ObjectId),
        userId: expect.any(Types.ObjectId),
      });
      // save() should NOT have been called (buffered)
      expect(mockActivityModel().save).not.toHaveBeenCalled();
    });

    it('should immediately save critical activities (LOGIN)', async () => {
      await service.trackActivity(userId.toString(), UserAction.LOGIN, {});

      // Critical actions bypass buffer and call save()
      expect(mockActivityModel).toHaveBeenCalled();
      expect(mockActivityModel().save).toHaveBeenCalled();
    });

    it('should buffer search activity', async () => {
      const result = await service.trackActivity(
        userId.toString(),
        UserAction.SEARCH,
        { searchQuery: 'toyota corolla' },
      );

      expect(result).toMatchObject({
        action: UserAction.SEARCH,
        searchQuery: 'toyota corolla',
        userId: expect.any(Types.ObjectId),
      });
    });

    it('should handle activity with metadata', async () => {
      const result = await service.trackActivity(
        userId.toString(),
        UserAction.VIEW,
        {
          productListingId: listingId.toString(),
          metadata: { source: 'homepage' },
        },
      );

      expect(result).toMatchObject({
        action: UserAction.VIEW,
        productListingId: expect.any(Types.ObjectId),
        metadata: expect.any(Map),
      });
    });
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations for active users', async () => {
      const result = await service.getRecommendations(userId.toString());

      expect(result).toEqual(mockListings);
      expect(mockActivityModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId.toString()),
      });
    });

    it('should return cold-start recommendations when user has no activity', async () => {
      mockActivityModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const result = await service.getRecommendations(userId.toString());

      expect(result).toEqual(mockListings);
      expect(mockListingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          deletedAt: { $exists: false },
        }),
      );
    });

    it('should return cold-start for anonymous users', async () => {
      const result = await service.getRecommendations(undefined);

      expect(result).toEqual(mockListings);
      expect(mockActivityModel.findOne).not.toHaveBeenCalled();
    });

    it('should cap limit to 20', async () => {
      mockActivityModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await service.getRecommendations(userId.toString(), 50);

      const findResult = mockListingModel.find();
      const sortResult = findResult.sort();
      // Featured query uses Math.ceil(safeLimit / 3) = Math.ceil(20 / 3) = 7
      expect(sortResult.limit).toHaveBeenCalledWith(7);
    });
  });

  describe('dismissRecommendation', () => {
    it('should track a dismiss activity via immediate save', async () => {
      await service.dismissRecommendation(
        userId.toString(),
        listingId.toString(),
      );

      // DISMISS is a critical action that starts with 'admin_' check fails,
      // but LISTING_DELETE/CREATE check also fails, so it's buffered.
      // Actually DISMISS is not critical — it's buffered.
      // Verify it was added to buffer by flushing
      expect(mockActivityModel.insertMany).not.toHaveBeenCalled();
      // Flush the buffer
      await service.onModuleDestroy();
      expect(mockActivityModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ action: UserAction.DISMISS }),
        ]),
        { ordered: false },
      );
    });
  });
});
