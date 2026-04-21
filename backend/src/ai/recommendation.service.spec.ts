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

  const mockActivity = {
    _id: new Types.ObjectId(),
    userId,
    action: UserAction.VIEW,
    productListingId: listingId,
    categoryId,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const saveFn = jest.fn().mockResolvedValue(mockActivity);

    mockActivityModel = jest.fn().mockImplementation(() => ({
      save: saveFn,
    }));
    mockActivityModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(5),
    });
    mockActivityModel.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([{ ...mockActivity, categoryId }]),
        }),
      }),
    });
    mockActivityModel.deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 10 }),
    });

    mockListingModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockListings),
          }),
        }),
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

  describe('trackActivity', () => {
    it('should create and save a user activity', async () => {
      const result = await service.trackActivity(
        userId.toString(),
        UserAction.VIEW,
        {
          productListingId: listingId.toString(),
          categoryId: categoryId.toString(),
        },
      );

      expect(result).toEqual(mockActivity);
    });

    it('should handle search activity with query', async () => {
      const result = await service.trackActivity(
        userId.toString(),
        UserAction.SEARCH,
        {
          searchQuery: 'toyota corolla',
        },
      );

      expect(result).toEqual(mockActivity);
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

      expect(result).toEqual(mockActivity);
    });
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations for active users', async () => {
      const result = await service.getRecommendations(userId.toString());

      expect(result).toEqual(mockListings);
      expect(mockActivityModel.countDocuments).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId.toString()),
      });
    });

    it('should return cold-start recommendations for new users', async () => {
      mockActivityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.getRecommendations(
        userId.toString(),
        31.52,
        74.35,
      );

      expect(result).toEqual(mockListings);
      expect(mockListingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          location: expect.objectContaining({
            $near: expect.any(Object),
          }),
        }),
      );
    });

    it('should return cold-start without location for new users without coords', async () => {
      mockActivityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
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

    it('should cap limit to 20', async () => {
      mockActivityModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.getRecommendations(
        userId.toString(),
        undefined,
        undefined,
        50,
      );

      const findResult = mockListingModel.find();
      const sortResult = findResult.sort();
      expect(sortResult.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('dismissRecommendation', () => {
    it('should track a dismiss activity', async () => {
      await service.dismissRecommendation(
        userId.toString(),
        listingId.toString(),
      );

      expect(mockActivityModel).toHaveBeenCalled();
    });
  });

  describe('updateRecommendationModels', () => {
    it('should clean up old activity data', async () => {
      await service.updateRecommendationModels();

      expect(mockActivityModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.objectContaining({
            $lt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
