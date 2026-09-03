import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
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
import {
  ShortVideo,
  ShortVideoDocument,
} from '../shorts/schemas/short-video.schema.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { INACTIVE_CONVERSATION_RETENTION_DAYS } from '../common/constants/app.constants.js';
import { daysToMs } from '../common/utils/time.js';

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
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(ShortVideo.name)
    private readonly shortVideoModel: Model<ShortVideoDocument>,
  ) {}

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<{
    conversation: ConversationDocument;
    message?: MessageDocument;
  }> {
    const { productListingId, shortVideoId, message } = dto;

    if (!productListingId && !shortVideoId) {
      throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
    }

    let sellerId: Types.ObjectId;
    const buyerId = new Types.ObjectId(userId);

    if (productListingId) {
      // Listing-based conversation
      if (!Types.ObjectId.isValid(productListingId)) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
      }

      const listing = await this.listingModel.findById(productListingId).exec();
      if (!listing) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
      }

      if (listing.sellerId.toString() === userId) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_NOT_ALLOWED);
      }

      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_NOT_ALLOWED);
      }

      sellerId = listing.sellerId;

      // Try to find existing conversation for this listing
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

      const savedMessage = await this.optionallySendMessage(
        conversation,
        buyerId,
        message,
      );
      return { conversation, message: savedMessage };
    } else {
      // Short-based conversation
      if (!Types.ObjectId.isValid(shortVideoId!)) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
      }

      const short = await this.shortVideoModel
        .findById(shortVideoId!)
        .select('sellerId')
        .lean()
        .exec();

      if (!short) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
      }

      sellerId = new Types.ObjectId(short.sellerId.toString());

      if (sellerId.toString() === userId) {
        throw new BadRequestException(PUBLIC_ERROR.MESSAGING_NOT_ALLOWED);
      }

      // Try to find existing conversation for this short
      const shortObjId = new Types.ObjectId(shortVideoId!);
      let conversation = await this.conversationModel
        .findOne({
          shortVideoId: shortObjId,
          $or: [
            { buyerId, sellerId },
            { buyerId: sellerId, sellerId: buyerId },
          ],
        })
        .exec();

      // Fallback: find any conversation for this short involving the current user
      if (!conversation) {
        conversation = await this.conversationModel
          .findOne({
            shortVideoId: shortObjId,
            $or: [{ buyerId }, { sellerId: buyerId }],
          })
          .exec();
      }

      if (!conversation) {
        conversation = new this.conversationModel({
          shortVideoId: shortObjId,
          buyerId,
          sellerId,
        });
        try {
          await conversation.save();
        } catch (err: any) {
          if (err.code === 11000) {
            // Duplicate key on productListingId index (non-sparse legacy index)
            // Find the existing conversation between these users for shorts
            conversation = await this.conversationModel
              .findOne({
                buyerId,
                sellerId,
                productListingId: { $exists: false },
                shortVideoId: shortObjId,
              })
              .exec();
            // If still not found, try without shortVideoId filter
            if (!conversation) {
              conversation = await this.conversationModel
                .findOne({
                  buyerId,
                  sellerId,
                  productListingId: null,
                })
                .exec();
            }
            if (!conversation) {
              throw new BadRequestException(PUBLIC_ERROR.MESSAGING_FAILED);
            }
          } else {
            throw err;
          }
        }
      }

      const savedMessage = await this.optionallySendMessage(
        conversation,
        buyerId,
        message,
      );
      return { conversation, message: savedMessage };
    }
  }

  private async optionallySendMessage(
    conversation: ConversationDocument,
    senderId: Types.ObjectId,
    message?: string,
  ): Promise<MessageDocument | undefined> {
    if (!message) return undefined;

    const savedMessage = new this.messageModel({
      conversationId: conversation._id,
      senderId,
      content: message,
    });
    await savedMessage.save();

    conversation.lastMessageAt = savedMessage.createdAt;
    conversation.lastMessagePreview =
      message.length > PREVIEW_MAX_LENGTH
        ? message.substring(0, PREVIEW_MAX_LENGTH) + '...'
        : message;
    await conversation.save();

    return savedMessage;
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
      .populate(
        'shortVideoId',
        'title description video.thumbnailUrl video.url status',
      )
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();

    // Hide conversations for non-active listings older than 30 days
    const cutoff = new Date(
      Date.now() - daysToMs(INACTIVE_CONVERSATION_RETENTION_DAYS),
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Verify user is a participant
    const userObjectId = userId;
    if (
      conversation.buyerId.toString() !== userObjectId &&
      conversation.sellerId.toString() !== userObjectId
    ) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }

    // Check listing is still active
    const listing = await this.listingModel
      .findById(conversation.productListingId)
      .select('status')
      .exec();
    if (listing && listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(PUBLIC_ERROR.MESSAGING_NOT_ALLOWED);
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

  /**
   * Throws unless the user is one of the two parties to the conversation.
   *
   * Exists so a caller can establish that *before* doing expensive or persistent
   * work. The media endpoints used to process and store an upload first and only
   * discover the caller was a stranger when `sendMessage` refused it — by which
   * point attacker-controlled bytes were on disk under a publicly-served path,
   * in someone else's conversation folder, with nothing to clean them up.
   */
  async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }

    return conversation;
  }

  async markConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<{ marked: number }> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
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
