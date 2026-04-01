import { MessagingService } from './messaging.service.js';
import { MessagingGateway } from './messaging.gateway.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
export declare class MessagingController {
    private readonly messagingService;
    private readonly messagingGateway;
    constructor(messagingService: MessagingService, messagingGateway: MessagingGateway);
    createConversation(userId: string, dto: CreateConversationDto): Promise<{
        conversation: import("./schemas/conversation.schema.js").ConversationDocument;
        message?: import("./schemas/message.schema.js").MessageDocument;
    }>;
    getUserConversations(userId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/conversation.schema.js").Conversation, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/conversation.schema.js").Conversation & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    getUnreadPerConversation(userId: string): Promise<Record<string, number>>;
    getConversationMessages(conversationId: string, userId: string, page?: string): Promise<{
        messages: import("./schemas/message.schema.js").MessageDocument[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    sendMessage(conversationId: string, userId: string, dto: SendMessageDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/message.schema.js").Message, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/message.schema.js").Message & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    markAsRead(conversationId: string, userId: string): Promise<{
        marked: number;
    }>;
}
