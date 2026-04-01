import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Model } from 'mongoose';
import { ConversationDocument } from './schemas/conversation.schema.js';
import { MessageDocument } from './schemas/message.schema.js';
import { UserDocument } from '../users/schemas/user.schema.js';
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
export declare class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly conversationModel;
    private readonly messageModel;
    private readonly userModel;
    server: Server;
    private userSockets;
    private socketUsers;
    constructor(conversationModel: Model<ConversationDocument>, messageModel: Model<MessageDocument>, userModel: Model<UserDocument>);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleSendMessage(client: Socket, payload: SendMessagePayload): Promise<{
        success: boolean;
        message?: MessageDocument;
        error?: string;
    }>;
    handleTyping(client: Socket, payload: TypingPayload): Promise<void>;
    handleMarkRead(client: Socket, payload: MarkReadPayload): Promise<{
        success: boolean;
        error?: string;
    }>;
    containsProhibitedContent(text: string): boolean;
    isUserOnline(userId: string): boolean;
    sendPushNotification(recipientId: string, conversationId: string, messageContent: string): Promise<void>;
    joinUserToRoom(userId: string, conversationId: string): Promise<void>;
}
