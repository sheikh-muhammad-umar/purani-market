import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { AiController } from './ai.controller';
import { RecommendationService } from './recommendation.service';
import { ChatbotService } from './chatbot.service';

describe('AiController', () => {
  let controller: AiController;
  let mockRecommendationService: Partial<
    Record<keyof RecommendationService, jest.Mock>
  >;
  let mockChatbotService: Partial<Record<keyof ChatbotService, jest.Mock>>;

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

    mockChatbotService = {
      processMessage: jest.fn().mockResolvedValue({
        reply: 'Hello! How can I help?',
        escalated: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: RecommendationService, useValue: mockRecommendationService },
        { provide: ChatbotService, useValue: mockChatbotService },
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

  describe('chatbotMessage', () => {
    it('should process chatbot message and return reply', async () => {
      const result = await controller.chatbotMessage({
        message: 'Hello',
        sessionId: 'test-session',
      });

      expect(mockChatbotService.processMessage).toHaveBeenCalledWith(
        'test-session',
        'Hello',
      );
      expect(result.reply).toBe('Hello! How can I help?');
      expect(result.escalated).toBe(false);
      expect(result.sessionId).toBe('test-session');
    });

    it('should generate sessionId when not provided', async () => {
      const result = await controller.chatbotMessage({
        message: 'Hello',
      });

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('should return escalated status when chatbot escalates', async () => {
      mockChatbotService.processMessage!.mockResolvedValue({
        reply: 'Connecting to human support...',
        escalated: true,
      });

      const result = await controller.chatbotMessage({
        message: 'complex question',
        sessionId: 'test-session',
      });

      expect(result.escalated).toBe(true);
    });
  });
});
