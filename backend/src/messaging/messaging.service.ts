import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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
  MediaPayload,
} from './schemas/message.schema.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { ERROR } from '../common/constants/error-messages.js';
import { INACTIVE_CONVERSATION_RETENTION_DAYS } from '../common/constants/app.constants.js';

/** Options for sending a rich message (image, voice, location). */
export interface SendMessageOptions {
  type?: MessageType;
  media?: MediaPayload;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLive?: boolean;
    liveDurationMinutes?: number;
  };
}

/** Preview labels shown in conversation list for non-text messages. */
const MESSAGE_PREVIEW: Record<string, string> = {
  [MessageType.IMAGE]: '📷 Photo',
  [MessageType.VOICE]: '🎤 Voice message',
  [MessageType.LOCATION]: '📍 Location',
};

const PREVIEW_MAX_LENGTH = 100;
const MESSAGES_PER_PAGE = 20;

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
  ) {}

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<{
    conversation: ConversationDocument;
    message?: MessageDocument;
  }> {
    const { productListingId, message } = dto;

    if (!Types.ObjectId.isValid(productListingId)) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    const listing = await this.listingModel.findById(productListingId).exec();
    if (!listing) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    if (listing.sellerId.toString() === userId) {
      throw new BadRequestException(ERROR.CANNOT_MESSAGE_OWN_LISTING);
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(ERROR.LISTING_NOT_ACTIVE_MESSAGING);
    }

    const buyerId = new Types.ObjectId(userId);
    const sellerId = listing.sellerId;

    // Try to find existing conversation
    let conversation = await this.conversationModel
      .findOne({ buyerId, sellerId, productListingId: listing._id })
      .exec();

    if (!conversation) {
      conversation = new this.conversationModel({
        productListingId: listing._id,
        buyerId,
        sellerId,
      });
      await conversation.save();
    }

    // Optionally send first message
    let savedMessage: MessageDocument | undefined;
    if (message) {
      savedMessage = new this.messageModel({
        conversationId: conversation._id,
        senderId: buyerId,
        content: message,
      });
      await savedMessage.save();

      // Update conversation with last message info
      conversation.lastMessageAt = savedMessage.createdAt;
      conversation.lastMessagePreview =
        message.length > PREVIEW_MAX_LENGTH
          ? message.substring(0, PREVIEW_MAX_LENGTH) + '...'
          : message;
      await conversation.save();
    }

    return { conversation, message: savedMessage };
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    const conversations = await this.conversationModel
      .find({
        $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }],
      })
      .populate('buyerId', 'profile.firstName profile.lastName profile.avatar')
      .populate('sellerId', 'profile.firstName profile.lastName profile.avatar')
      .populate('productListingId', 'title price images status')
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();

    // Hide conversations for non-active listings older than 30 days
    const cutoff = new Date(
      Date.now() - INACTIVE_CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    return conversations.filter((conv) => {
      const listing = conv.productListingId as any;
      if (!listing || listing.status === ListingStatus.ACTIVE) return true;
      const lastActivity = conv.lastMessageAt ?? conv.createdAt;
      return lastActivity > cutoff;
    });
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
  ): Promise<{
    messages: MessageDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }

    // Verify user is a participant
    const userObjectId = userId;
    if (
      conversation.buyerId.toString() !== userObjectId &&
      conversation.sellerId.toString() !== userObjectId
    ) {
      throw new ForbiddenException(ERROR.NOT_CONVERSATION_PARTICIPANT);
    }

    const limit = MESSAGES_PER_PAGE;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: conversation._id })
        .populate(
          'senderId',
          'profile.firstName profile.lastName profile.avatar',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel
        .countDocuments({ conversationId: conversation._id })
        .exec(),
    ]);

    return {
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    options?: SendMessageOptions,
  ): Promise<MessageDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(ERROR.NOT_CONVERSATION_PARTICIPANT);
    }

    // Check listing is still active
    const listing = await this.listingModel
      .findById(conversation.productListingId)
      .select('status')
      .exec();
    if (listing && listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(ERROR.LISTING_NOT_ACTIVE_MESSAGING);
    }

    const msgType = options?.type || MessageType.TEXT;

    const messageData: Record<string, any> = {
      conversationId: conversation._id,
      senderId: new Types.ObjectId(userId),
      type: msgType,
      content: (content || '').trim(),
    };

    if (options?.media) {
      messageData.media = options.media;
    }

    if (options?.location) {
      messageData.location = {
        latitude: options.location.latitude,
        longitude: options.location.longitude,
        address: options.location.address,
        isLive: options.location.isLive || false,
        expiresAt:
          options.location.isLive && options.location.liveDurationMinutes
            ? new Date(
                Date.now() + options.location.liveDurationMinutes * 60 * 1000,
              )
            : undefined,
      };
    }

    const message = new this.messageModel(messageData);
    const saved = await message.save();

    let preview = MESSAGE_PREVIEW[msgType] ?? content ?? '';
    if (preview.length > PREVIEW_MAX_LENGTH) {
      preview = preview.substring(0, PREVIEW_MAX_LENGTH) + '...';
    }

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageAt: saved.createdAt,
      lastMessagePreview: preview,
    });

    return saved;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const userObjectId = new Types.ObjectId(userId);
    // Find all conversations the user is part of
    const conversations = await this.conversationModel
      .find({ $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }] })
      .select('_id')
      .exec();
    const conversationIds = conversations.map((c) => c._id);

    // Count unread messages not sent by this user
    const count = await this.messageModel
      .countDocuments({
        conversationId: { $in: conversationIds },
        senderId: { $ne: userObjectId },
        isRead: false,
      })
      .exec();

    return { count };
  }

  async getConversationById(
    conversationId: string,
  ): Promise<ConversationDocument | null> {
    if (!Types.ObjectId.isValid(conversationId)) return null;
    return this.conversationModel.findById(conversationId).exec();
  }

  async markConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<{ marked: number }> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(ERROR.CONVERSATION_NOT_FOUND);
    }
    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(ERROR.NOT_CONVERSATION_PARTICIPANT);
    }

    const result = await this.messageModel
      .updateMany(
        {
          conversationId: conversation._id,
          senderId: { $ne: new Types.ObjectId(userId) },
          isRead: false,
        },
        { $set: { isRead: true } },
      )
      .exec();

    return { marked: result.modifiedCount };
  }

  async getUnreadPerConversation(
    userId: string,
  ): Promise<Record<string, number>> {
    const userObjectId = new Types.ObjectId(userId);
    const conversations = await this.conversationModel
      .find({ $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }] })
      .select('_id')
      .exec();

    const counts: Record<string, number> = {};
    for (const conv of conversations) {
      const count = await this.messageModel
        .countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userObjectId },
          isRead: false,
        })
        .exec();
      if (count > 0) {
        counts[conv._id.toString()] = count;
      }
    }
    return counts;
  }
}
