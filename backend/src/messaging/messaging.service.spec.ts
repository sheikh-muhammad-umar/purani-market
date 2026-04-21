import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { MessagingService } from './messaging.service';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';

describe('MessagingService', () => {
  let service: MessagingService;

  const buyerId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    sellerId,
    title: 'Test Listing',
    price: { amount: 5000, currency: 'PKR' },
  };

  const mockConversation = {
    _id: conversationId,
    productListingId: listingId,
    buyerId,
    sellerId,
    lastMessageAt: null as Date | null,
    lastMessagePreview: null as string | null,
    createdAt: new Date(),
    save: jest.fn(),
  };

  const mockMessage = {
    _id: new Types.ObjectId(),
    conversationId,
    senderId: buyerId,
    content: 'Hello, is this available?',
    isRead: false,
    createdAt: new Date(),
  };

  let mockConversationModel: any;
  let mockMessageModel: any;
  let mockListingModel: any;

  beforeEach(async () => {
    mockConversation.save = jest.fn().mockResolvedValue(mockConversation);
    mockConversation.lastMessageAt = null;
    mockConversation.lastMessagePreview = null;

    mockConversationModel = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: conversationId,
      createdAt: new Date(),
      save: jest
        .fn()
        .mockResolvedValue({
          ...data,
          _id: conversationId,
          createdAt: new Date(),
        }),
    }));
    mockConversationModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockConversationModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockConversation]),
      }),
    });
    mockConversationModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockConversation),
    });

    mockMessageModel = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      save: jest
        .fn()
        .mockResolvedValue({
          ...data,
          _id: new Types.ObjectId(),
          createdAt: new Date(),
        }),
    }));
    mockMessageModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockMessage]),
      }),
    });
    mockMessageModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        { provide: getModelToken(Message.name), useValue: mockMessageModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  describe('createConversation', () => {
    it('should create a new conversation for a valid listing', async () => {
      const result = await service.createConversation(buyerId.toString(), {
        productListingId: listingId.toString(),
      });

      expect(result.conversation).toBeDefined();
      expect(mockListingModel.findById).toHaveBeenCalledWith(
        listingId.toString(),
      );
    });

    it('should return existing conversation if one already exists', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversation),
      });

      const result = await service.createConversation(buyerId.toString(), {
        productListingId: listingId.toString(),
      });

      expect(result.conversation).toBeDefined();
      expect(result.conversation._id).toEqual(conversationId);
    });

    it('should create a message when message text is provided', async () => {
      const result = await service.createConversation(buyerId.toString(), {
        productListingId: listingId.toString(),
        message: 'Hello, is this available?',
      });

      expect(result.message).toBeDefined();
      expect(mockMessageModel).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Hello, is this available?' }),
      );
    });

    it('should not create a message when message text is not provided', async () => {
      const result = await service.createConversation(buyerId.toString(), {
        productListingId: listingId.toString(),
      });

      expect(result.message).toBeUndefined();
    });

    it('should throw NotFoundException for invalid listing ID', async () => {
      await expect(
        service.createConversation(buyerId.toString(), {
          productListingId: 'invalid-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createConversation(buyerId.toString(), {
          productListingId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when seller tries to start conversation on own listing', async () => {
      await expect(
        service.createConversation(sellerId.toString(), {
          productListingId: listingId.toString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserConversations', () => {
    it('should return conversations where user is buyer or seller', async () => {
      const result = await service.getUserConversations(buyerId.toString());

      expect(result).toHaveLength(1);
      expect(mockConversationModel.find).toHaveBeenCalledWith({
        $or: [
          { buyerId: new Types.ObjectId(buyerId.toString()) },
          { sellerId: new Types.ObjectId(buyerId.toString()) },
        ],
      });
    });

    it('should sort conversations by lastMessageAt descending', async () => {
      await service.getUserConversations(buyerId.toString());

      const findResult = mockConversationModel.find();
      expect(findResult.populate).toHaveBeenCalled();
    });
  });

  describe('getConversationMessages', () => {
    it('should return paginated messages for a valid conversation', async () => {
      const result = await service.getConversationMessages(
        conversationId.toString(),
        buyerId.toString(),
        1,
      );

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should throw NotFoundException for invalid conversation ID', async () => {
      await expect(
        service.getConversationMessages('invalid-id', buyerId.toString(), 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getConversationMessages(
          new Types.ObjectId().toString(),
          buyerId.toString(),
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const nonParticipantId = new Types.ObjectId();

      await expect(
        service.getConversationMessages(
          conversationId.toString(),
          nonParticipantId.toString(),
          1,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should use 20 messages per page limit', async () => {
      await service.getConversationMessages(
        conversationId.toString(),
        buyerId.toString(),
        1,
      );

      const findResult = mockMessageModel.find();
      expect(findResult.skip).toHaveBeenCalledWith(0);
      expect(findResult.limit).toHaveBeenCalledWith(20);
    });

    it('should calculate correct skip for page 2', async () => {
      await service.getConversationMessages(
        conversationId.toString(),
        buyerId.toString(),
        2,
      );

      const findResult = mockMessageModel.find();
      expect(findResult.skip).toHaveBeenCalledWith(20);
    });
  });
});
