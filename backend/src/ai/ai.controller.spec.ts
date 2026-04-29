import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { AiController } from './ai.controller';
import { RecommendationService } from './recommendation.service';

describe('AiController', () => {
  let controller: AiController;
  let mockRecommendationService: Partial<
    Record<keyof RecommendationService, jest.Mock>
  >;

  const userId = new Types.ObjectId();
  const listingId = new Types.ObjectId();

  const mockListings = [
    { _id: new Types.ObjectId(), title: 'Listing 1', status: 'active' },
    { _id: new Types.ObjectId(), title: 'Listing 2', status: 'active' },
  ];

  beforeEach(async () => {
    mockRecommendationService = {
      getRecommendations: jest.fn().mockResolvedValue(mockListings),
      dismissRecommendation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: RecommendationService, useValue: mockRecommendationService },
        Reflector,
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  describe('getRecommendations', () => {
    it('should return recommendations for authenticated user', async () => {
      const result = await controller.getRecommendations(userId.toString());

      expect(mockRecommendationService.getRecommendations).toHaveBeenCalledWith(
        userId.toString(),
        undefined,
      );
      expect(result).toEqual({ data: mockListings });
    });

    it('should pass limit parameter when provided', async () => {
      await controller.getRecommendations(userId.toString(), '10');

      expect(mockRecommendationService.getRecommendations).toHaveBeenCalledWith(
        userId.toString(),
        10,
      );
    });
  });

  describe('dismissRecommendation', () => {
    it('should dismiss a recommendation', async () => {
      const result = await controller.dismissRecommendation(userId.toString(), {
        productListingId: listingId.toString(),
      });

      expect(
        mockRecommendationService.dismissRecommendation,
      ).toHaveBeenCalledWith(userId.toString(), listingId.toString());
      expect(result).toEqual({
        message: 'Recommendation dismissed successfully',
      });
    });
  });
});
