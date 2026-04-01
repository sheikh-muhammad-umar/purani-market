import { Model } from 'mongoose';
import { ConversationDocument } from './schemas/conversation.schema.js';
import { MessageDocument } from './schemas/message.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
export declare class MessagingService {
    private readonly conversationModel;
    private readonly messageModel;
    private readonly listingModel;
    constructor(conversationModel: Model<ConversationDocument>, messageModel: Model<MessageDocument>, listingModel: Model<ProductListingDocument>);
    createConversation(userId: string, dto: CreateConversationDto): Promise<{
        conversation: ConversationDocument;
        message?: MessageDocument;
    }>;
    getUserConversations(userId: string): Promise<ConversationDocument[]>;
    getConversationMessages(conversationId: string, userId: string, page?: number): Promise<{
        messages: MessageDocument[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    sendMessage(conversationId: string, userId: string, content: string): Promise<MessageDocument>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    getConversationById(conversationId: string): Promise<ConversationDocument | null>;
    markConversationRead(conversationId: string, userId: string): Promise<{
        marked: number;
    }>;
    getUnreadPerConversation(userId: string): Promise<Record<string, number>>;
}
