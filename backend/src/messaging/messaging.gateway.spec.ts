import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MessagingGateway } from './messaging.gateway';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';
import { User } from '../users/schemas/user.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { Server, Socket } from 'socket.io';

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;

  const buyerId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();
  const messageId = new Types.ObjectId();

  const mockConversation = {
    _id: conversationId,
    buyerId,
    sellerId,
    productListingId: new Types.ObjectId(),
    lastMessageAt: null,
    lastMessagePreview: null,
  };

  const mockSavedMessage = {
    _id: messageId,
    conversationId,
    senderId: buyerId,
    content: 'Hello seller',
    isRead: false,
    createdAt: new Date(),
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    }),
  };

  const mockConversationModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockMessageModel: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: messageId,
    createdAt: new Date(),
    save: jest.fn().mockResolvedValue({
      ...data,
      _id: messageId,
      createdAt: new Date(),
    }),
  }));
  mockMessageModel.updateMany = jest
    .fn()
    .mockResolvedValue({ modifiedCount: 1 });

  const mockUserModel = {
    findById: jest.fn(),
  };

  // Helper to create a mock socket
  function createMockSocket(id: string, userId?: string): Socket {
    const rooms = new Set<string>();
    return {
      id,
      handshake: { query: { userId } },
      join: jest.fn().mockImplementation((room: string) => {
        rooms.add(room);
        return Promise.resolve();
      }),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      disconnect: jest.fn(),
      rooms,
    } as unknown as Socket;
  }

  function createMockServer(): Server {
    const emitFn = jest.fn();
    return {
      to: jest.fn().mockReturnValue({ emit: emitFn }),
      emit: emitFn,
    } as unknown as Server;
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConversationModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([mockConversation]),
    });
    mockConversationModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockConversation),
    });
    mockConversationModel.findByIdAndUpdate.mockResolvedValue(mockConversation);

    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          deviceTokens: [{ platform: 'android', token: 'token123' }],
          notificationPreferences: { messages: true },
        }),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        { provide: getModelToken(Message.name), useValue: mockMessageModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({ status: 'active' }),
              }),
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
    gateway.server = createMockServer();
  });

  describe('handleConnection', () => {
    it('should register user and join conversation rooms', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith(
        `conversation:${conversationId.toString()}`,
      );
      expect(gateway.isUserOnline(buyerId.toString())).toBe(true);
    });

    it('should disconnect client with no userId', async () => {
      const client = createMockSocket('socket2');
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with invalid userId', async () => {
      const client = createMockSocket('socket3', 'invalid-id');
      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from tracking on disconnect', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);
      expect(gateway.isUserOnline(buyerId.toString())).toBe(true);

      gateway.handleDisconnect(client);
      expect(gateway.isUserOnline(buyerId.toString())).toBe(false);
    });

    it('should keep user online if they have other sockets', async () => {
      const client1 = createMockSocket('socket1', buyerId.toString());
      const client2 = createMockSocket('socket2', buyerId.toString());
      await gateway.handleConnection(client1);
      await gateway.handleConnection(client2);

      gateway.handleDisconnect(client1);
      expect(gateway.isUserOnline(buyerId.toString())).toBe(true);
    });
  });

  describe('handleSendMessage', () => {
    it('should persist and broadcast a valid message', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: 'Hello seller',
      });

      expect(result.success).toBe(true);
      expect(mockMessageModel).toHaveBeenCalled();
      expect(gateway.server.to).toHaveBeenCalledWith(
        `conversation:${conversationId.toString()}`,
      );
    });

    it('should reject message from non-authenticated socket', async () => {
      const client = createMockSocket('socket-unknown');
      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should reject message with invalid conversation ID', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'invalid',
        content: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid conversation ID');
    });

    it('should reject empty message content', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message content is required');
    });

    it('should reject message from non-participant', async () => {
      const outsiderId = new Types.ObjectId();
      const client = createMockSocket('socket1', outsiderId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'You are not a participant in this conversation',
      );
    });

    it('should block message with prohibited content and notify sender', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: 'This is a scam product',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Message contains prohibited content');
      expect(client.emit).toHaveBeenCalledWith('messageBlocked', {
        conversationId: conversationId.toString(),
        reason: 'Your message contains prohibited content and was not sent.',
      });
    });

    it('should trigger push notification for offline recipient', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);
      // Seller is NOT connected, so they are offline

      const result = await gateway.handleSendMessage(client, {
        conversationId: conversationId.toString(),
        content: 'Are you available?',
      });

      expect(result.success).toBe(true);
      // The push notification stub should have been called for the seller
      expect(mockUserModel.findById).toHaveBeenCalledWith(sellerId.toString());
    });

    it('should NOT trigger push notification for online recipient', async () => {
      const buyerClient = createMockSocket('socket1', buyerId.toString());
      const sellerClient = createMockSocket('socket2', sellerId.toString());
      await gateway.handleConnection(buyerClient);
      await gateway.handleConnection(sellerClient);

      mockUserModel.findById.mockClear();

      await gateway.handleSendMessage(buyerClient, {
        conversationId: conversationId.toString(),
        content: 'Hello!',
      });

      // Push notification should NOT be triggered since seller is online
      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('handleTyping', () => {
    it('should broadcast typing indicator to conversation room', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      await gateway.handleTyping(client, {
        conversationId: conversationId.toString(),
      });

      expect(client.to).toHaveBeenCalledWith(
        `conversation:${conversationId.toString()}`,
      );
    });

    it('should not broadcast for unauthenticated socket', async () => {
      const client = createMockSocket('socket-unknown');
      await gateway.handleTyping(client, {
        conversationId: conversationId.toString(),
      });

      expect(client.to).not.toHaveBeenCalled();
    });

    it('should not broadcast for invalid conversation ID', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      await gateway.handleTyping(client, { conversationId: 'invalid' });

      expect(client.to).not.toHaveBeenCalled();
    });
  });

  describe('handleMarkRead', () => {
    it('should mark messages as read and notify participants', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const msgId = new Types.ObjectId().toString();
      const result = await gateway.handleMarkRead(client, {
        conversationId: conversationId.toString(),
        messageIds: [msgId],
      });

      expect(result.success).toBe(true);
      expect(mockMessageModel.updateMany).toHaveBeenCalled();
      expect(gateway.server.to).toHaveBeenCalledWith(
        `conversation:${conversationId.toString()}`,
      );
    });

    it('should reject markRead from non-authenticated socket', async () => {
      const client = createMockSocket('socket-unknown');
      const result = await gateway.handleMarkRead(client, {
        conversationId: conversationId.toString(),
        messageIds: [messageId.toString()],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should reject markRead with empty messageIds', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleMarkRead(client, {
        conversationId: conversationId.toString(),
        messageIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No message IDs provided');
    });

    it('should reject markRead from non-participant', async () => {
      const outsiderId = new Types.ObjectId();
      const client = createMockSocket('socket1', outsiderId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleMarkRead(client, {
        conversationId: conversationId.toString(),
        messageIds: [messageId.toString()],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'You are not a participant in this conversation',
      );
    });

    it('should reject markRead with invalid conversation ID', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      const result = await gateway.handleMarkRead(client, {
        conversationId: 'invalid',
        messageIds: [messageId.toString()],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid conversation ID');
    });
  });

  describe('containsProhibitedContent', () => {
    it('should detect prohibited words', () => {
      expect(gateway.containsProhibitedContent('this is a scam')).toBe(true);
      expect(gateway.containsProhibitedContent('FRAUD alert')).toBe(true);
      expect(gateway.containsProhibitedContent('hate speech')).toBe(true);
    });

    it('should allow clean content', () => {
      expect(
        gateway.containsProhibitedContent('Hello, is this available?'),
      ).toBe(false);
      expect(gateway.containsProhibitedContent('What is the best price?')).toBe(
        false,
      );
    });
  });

  describe('isUserOnline', () => {
    it('should return false for unknown user', () => {
      expect(gateway.isUserOnline(new Types.ObjectId().toString())).toBe(false);
    });

    it('should return true for connected user', async () => {
      const client = createMockSocket('socket1', buyerId.toString());
      await gateway.handleConnection(client);

      expect(gateway.isUserOnline(buyerId.toString())).toBe(true);
    });
  });
});
