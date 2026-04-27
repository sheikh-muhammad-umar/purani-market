import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { ChatMediaService } from './chat-media.service';

describe('MessagingController', () => {
  let controller: MessagingController;
  let service: MessagingService;

  const userId = new Types.ObjectId().toString();
  const conversationId = new Types.ObjectId().toString();

  const mockConversation = {
    _id: new Types.ObjectId(),
    productListingId: new Types.ObjectId(),
    buyerId: new Types.ObjectId(userId),
    sellerId: new Types.ObjectId(),
    createdAt: new Date(),
  };

  const mockMessage = {
    _id: new Types.ObjectId(),
    conversationId: new Types.ObjectId(),
    senderId: new Types.ObjectId(userId),
    content: 'Hello',
    isRead: false,
    createdAt: new Date(),
  };

  const mockMessagingService = {
    createConversation: jest.fn().mockResolvedValue({
      conversation: mockConversation,
      message: mockMessage,
    }),
    getUserConversations: jest.fn().mockResolvedValue([mockConversation]),
    getConversationMessages: jest.fn().mockResolvedValue({
      messages: [mockMessage],
      total: 1,
      page: 1,
      totalPages: 1,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: MessagingService, useValue: mockMessagingService },
        {
          provide: MessagingGateway,
          useValue: {
            server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
            joinUserToRoom: jest.fn(),
          },
        },
        {
          provide: ChatMediaService,
          useValue: { processImage: jest.fn(), processVoiceNote: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
    service = module.get<MessagingService>(MessagingService);
  });

  describe('createConversation', () => {
    it('should call service.createConversation with correct params', async () => {
      const dto = {
        productListingId: new Types.ObjectId().toString(),
        message: 'Hi',
      };
      await controller.createConversation(userId, dto);

      expect(mockMessagingService.createConversation).toHaveBeenCalledWith(
        userId,
        dto,
      );
    });

    it('should return conversation and message', async () => {
      const dto = { productListingId: new Types.ObjectId().toString() };
      const result = await controller.createConversation(userId, dto);

      expect(result.conversation).toBeDefined();
    });
  });

  describe('getUserConversations', () => {
    it('should call service.getUserConversations with userId', async () => {
      await controller.getUserConversations(userId);

      expect(mockMessagingService.getUserConversations).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should return array of conversations', async () => {
      const result = await controller.getUserConversations(userId);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getConversationMessages', () => {
    it('should call service with default page 1 when no page provided', async () => {
      await controller.getConversationMessages(conversationId, userId);

      expect(mockMessagingService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        userId,
        1,
      );
    });

    it('should parse page query parameter', async () => {
      await controller.getConversationMessages(conversationId, userId, '3');

      expect(mockMessagingService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        userId,
        3,
      );
    });

    it('should default to page 1 for invalid page values', async () => {
      await controller.getConversationMessages(conversationId, userId, '-1');

      expect(mockMessagingService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        userId,
        1,
      );
    });

    it('should return paginated messages', async () => {
      const result = await controller.getConversationMessages(
        conversationId,
        userId,
        '1',
      );

      expect(result.messages).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.page).toBeDefined();
      expect(result.totalPages).toBeDefined();
    });
  });
});
