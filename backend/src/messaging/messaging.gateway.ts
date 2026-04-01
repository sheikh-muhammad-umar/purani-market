import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema.js';
import { Message, MessageDocument } from './schemas/message.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';

const PROHIBITED_WORDS = [
  'spam',
  'scam',
  'fake',
  'fraud',
  'illegal',
  'hate',
  'violence',
  'abuse',
];

export interface SendMessagePayload {
  conversationId: string;
  content: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface MarkReadPayload {
  conversationId: string;
  messageIds: string[];
}

@WebSocketGateway({ namespace: '/ws/messaging', cors: { origin: '*' } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** Maps userId -> Set of socket IDs for that user */
  private userSockets = new Map<string, Set<string>>();
  /** Maps socketId -> userId */
  private socketUsers = new Map<string, string>();

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = client.handshake.query['userId'] as string | undefined;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      client.disconnect();
      return;
    }

    this.socketUsers.set(client.id, userId);
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    // Join user to all their conversation rooms
    const conversations = await this.conversationModel
      .find({
        $or: [
          { buyerId: new Types.ObjectId(userId) },
          { sellerId: new Types.ObjectId(userId) },
        ],
      })
      .exec();

    for (const conv of conversations) {
      await client.join(`conversation:${conv._id.toString()}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketUsers.delete(client.id);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<{ success: boolean; message?: MessageDocument; error?: string }> {
    const userId = this.socketUsers.get(client.id);
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const { conversationId, content } = payload;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return { success: false, error: 'Invalid conversation ID' };
    }

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Message content is required' };
    }

    // Verify conversation exists and user is a participant
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      return { success: false, error: 'You are not a participant in this conversation' };
    }

    // Check prohibited content
    if (this.containsProhibitedContent(content)) {
      client.emit('messageBlocked', {
        conversationId,
        reason: 'Your message contains prohibited content and was not sent.',
      });
      return { success: false, error: 'Message contains prohibited content' };
    }

    // Persist message to MongoDB
    const message = new this.messageModel({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(userId),
      content: content.trim(),
    });
    const savedMessage = await message.save();

    // Update conversation with last message info
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageAt: savedMessage.createdAt,
      lastMessagePreview: preview,
    });

    // Emit to all participants in the conversation room
    this.server
      .to(`conversation:${conversationId}`)
      .emit('newMessage', savedMessage);

    // Trigger push notification for offline recipient
    const recipientId =
      conversation.buyerId.toString() === userId
        ? conversation.sellerId.toString()
        : conversation.buyerId.toString();

    if (!this.isUserOnline(recipientId)) {
      this.sendPushNotification(recipientId, conversationId, content).catch(() => {
        // Push notification failures are non-critical
      });
    }

    return { success: true, message: savedMessage };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingPayload,
  ): Promise<void> {
    const userId = this.socketUsers.get(client.id);
    if (!userId) return;

    const { conversationId } = payload;
    if (!conversationId || !Types.ObjectId.isValid(conversationId)) return;

    // Broadcast typing indicator to other participants in the room
    client.to(`conversation:${conversationId}`).emit('userTyping', {
      conversationId,
      userId,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MarkReadPayload,
  ): Promise<{ success: boolean; error?: string }> {
    const userId = this.socketUsers.get(client.id);
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const { conversationId, messageIds } = payload;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return { success: false, error: 'Invalid conversation ID' };
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return { success: false, error: 'No message IDs provided' };
    }

    // Verify user is a participant
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      return { success: false, error: 'You are not a participant in this conversation' };
    }

    const validIds = messageIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (validIds.length === 0) {
      return { success: false, error: 'No valid message IDs' };
    }

    // Mark messages as read (only messages NOT sent by the current user)
    await this.messageModel.updateMany(
      {
        _id: { $in: validIds },
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
      { $set: { isRead: true } },
    );

    // Notify the sender that their messages were read
    this.server.to(`conversation:${conversationId}`).emit('messagesRead', {
      conversationId,
      messageIds: validIds.map((id) => id.toString()),
      readBy: userId,
    });

    return { success: true };
  }

  containsProhibitedContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    return PROHIBITED_WORDS.some((word) => lowerText.includes(word));
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * Stub for push notification delivery.
   * Actual FCM/HMS integration will be implemented in the Notifications module.
   */
  async sendPushNotification(
    recipientId: string,
    conversationId: string,
    messageContent: string,
  ): Promise<void> {
    const user = await this.userModel.findById(recipientId).select('deviceTokens notificationPreferences').exec();
    if (!user) return;

    // Respect notification preferences
    if (!user.notificationPreferences?.messages) return;

    // Stub: In production, this would call FCM/HMS providers
    // For now, just log the intent
    const preview = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;
    console.log(
      `[Push Notification Stub] Sending to user ${recipientId} for conversation ${conversationId}: "${preview}"`,
    );
  }

  /** Join all connected sockets of a user to a conversation room */
  async joinUserToRoom(userId: string, conversationId: string): Promise<void> {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return;
    const room = `conversation:${conversationId}`;
    for (const socketId of socketIds) {
      try {
        const sockets = await this.server.fetchSockets();
        const socket = sockets.find(s => s.id === socketId);
        if (socket) {
          socket.join(room);
        }
      } catch {
        // Socket may have disconnected
      }
    }
  }
}
