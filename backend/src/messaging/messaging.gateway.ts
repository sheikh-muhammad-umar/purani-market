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
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema.js';
import {
  Message,
  MessageDocument,
  MessageType,
} from './schemas/message.schema.js';
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

/** Preview labels shown in conversation list for non-text messages. */
const MESSAGE_PREVIEW: Record<string, string> = {
  [MessageType.IMAGE]: '📷 Photo',
  [MessageType.VOICE]: '🎤 Voice message',
  [MessageType.LOCATION]: '📍 Location',
};

const PREVIEW_MAX_LENGTH = 100;

/** Gateway error messages. */
const GW_ERROR = {
  NOT_AUTHENTICATED: 'Not authenticated',
  INVALID_CONVERSATION_ID: 'Invalid conversation ID',
  CONTENT_REQUIRED: 'Message content is required',
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  NOT_PARTICIPANT: 'You are not a participant in this conversation',
  PROHIBITED_CONTENT: 'Message contains prohibited content',
  NO_MESSAGE_IDS: 'No message IDs provided',
  NO_VALID_IDS: 'No valid message IDs',
} as const;

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: string;
  media?: {
    url: string;
    thumbnailUrl?: string;
    duration?: number;
    mimeType?: string;
    fileSize?: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLive?: boolean;
    liveDurationMinutes?: number;
  };
}

export interface TypingPayload {
  conversationId: string;
}

export interface MarkReadPayload {
  conversationId: string;
  messageIds: string[];
}

@WebSocketGateway({ namespace: '/ws/messaging', cors: { origin: '*' } })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
      return { success: false, error: GW_ERROR.NOT_AUTHENTICATED };
    }

    const { conversationId, content } = payload;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return { success: false, error: GW_ERROR.INVALID_CONVERSATION_ID };
    }

    const msgType = payload.type || MessageType.TEXT;

    if (
      msgType === MessageType.TEXT &&
      (!content || content.trim().length === 0)
    ) {
      return { success: false, error: GW_ERROR.CONTENT_REQUIRED };
    }

    // Verify conversation exists and user is a participant
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      return { success: false, error: GW_ERROR.CONVERSATION_NOT_FOUND };
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      return {
        success: false,
        error: GW_ERROR.NOT_PARTICIPANT,
      };
    }

    // Check prohibited content
    if (content && this.containsProhibitedContent(content)) {
      client.emit('messageBlocked', {
        conversationId,
        reason: 'Your message contains prohibited content and was not sent.',
      });
      return { success: false, error: GW_ERROR.PROHIBITED_CONTENT };
    }

    // Persist message to MongoDB
    const messageData: Record<string, any> = {
      conversationId: conversation._id,
      senderId: new Types.ObjectId(userId),
      type: msgType,
      content: (content || '').trim(),
    };

    if (payload.media) {
      messageData.media = payload.media;
    }

    if (payload.location) {
      messageData.location = {
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        address: payload.location.address,
        isLive: payload.location.isLive || false,
        expiresAt:
          payload.location.isLive && payload.location.liveDurationMinutes
            ? new Date(
                Date.now() + payload.location.liveDurationMinutes * 60 * 1000,
              )
            : undefined,
      };
    }

    const message = new this.messageModel(messageData);
    const savedMessage = await message.save();

    // Update conversation with last message info
    let preview = MESSAGE_PREVIEW[msgType] ?? content ?? '';
    if (preview.length > PREVIEW_MAX_LENGTH) {
      preview = preview.substring(0, PREVIEW_MAX_LENGTH) + '...';
    }
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
      this.sendPushNotification(recipientId, conversationId, content).catch(
        () => {
          // Push notification failures are non-critical
        },
      );
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
      return { success: false, error: GW_ERROR.NOT_AUTHENTICATED };
    }

    const { conversationId, messageIds } = payload;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return { success: false, error: GW_ERROR.INVALID_CONVERSATION_ID };
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return { success: false, error: GW_ERROR.NO_MESSAGE_IDS };
    }

    // Verify user is a participant
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      return { success: false, error: GW_ERROR.CONVERSATION_NOT_FOUND };
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      return {
        success: false,
        error: GW_ERROR.NOT_PARTICIPANT,
      };
    }

    const validIds = messageIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (validIds.length === 0) {
      return { success: false, error: GW_ERROR.NO_VALID_IDS };
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
    const user = await this.userModel
      .findById(recipientId)
      .select('deviceTokens notificationPreferences')
      .exec();
    if (!user) return;

    // Respect notification preferences
    if (!user.notificationPreferences?.messages) return;

    // Stub: In production, this would call FCM/HMS providers
    // For now, just log the intent
    const preview =
      messageContent.length > 50
        ? messageContent.substring(0, 50) + '...'
        : messageContent;
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
        const socket = sockets.find((s) => s.id === socketId);
        if (socket) {
          socket.join(room);
        }
      } catch {
        // Socket may have disconnected
      }
    }
  }
}
