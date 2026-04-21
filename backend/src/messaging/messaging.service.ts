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
import { Message, MessageDocument } from './schemas/message.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';

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
      throw new NotFoundException('Listing not found');
    }

    const listing = await this.listingModel.findById(productListingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId.toString() === userId) {
      throw new BadRequestException(
        'You cannot start a conversation on your own listing',
      );
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
        message.length > 100 ? message.substring(0, 100) + '...' : message;
      await conversation.save();
    }

    return { conversation, message: savedMessage };
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    return this.conversationModel
      .find({
        $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }],
      })
      .populate('buyerId', 'profile.firstName profile.lastName profile.avatar')
      .populate('sellerId', 'profile.firstName profile.lastName profile.avatar')
      .populate('productListingId', 'title price images status')
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();
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
      throw new NotFoundException('Conversation not found');
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is a participant
    const userObjectId = userId;
    if (
      conversation.buyerId.toString() !== userObjectId &&
      conversation.sellerId.toString() !== userObjectId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const limit = 20;
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
  ): Promise<MessageDocument> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException('Conversation not found');
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const message = new this.messageModel({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(userId),
      content: content.trim(),
    });
    const saved = await message.save();

    const preview =
      content.length > 100 ? content.substring(0, 100) + '...' : content;
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
      throw new NotFoundException('Conversation not found');
    }
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      conversation.buyerId.toString() !== userId &&
      conversation.sellerId.toString() !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
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
