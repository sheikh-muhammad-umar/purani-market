"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const conversation_schema_js_1 = require("./schemas/conversation.schema.js");
const message_schema_js_1 = require("./schemas/message.schema.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
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
let MessagingGateway = class MessagingGateway {
    conversationModel;
    messageModel;
    userModel;
    server;
    userSockets = new Map();
    socketUsers = new Map();
    constructor(conversationModel, messageModel, userModel) {
        this.conversationModel = conversationModel;
        this.messageModel = messageModel;
        this.userModel = userModel;
    }
    async handleConnection(client) {
        const userId = client.handshake.query['userId'];
        if (!userId || !mongoose_2.Types.ObjectId.isValid(userId)) {
            client.disconnect();
            return;
        }
        this.socketUsers.set(client.id, userId);
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(client.id);
        const conversations = await this.conversationModel
            .find({
            $or: [
                { buyerId: new mongoose_2.Types.ObjectId(userId) },
                { sellerId: new mongoose_2.Types.ObjectId(userId) },
            ],
        })
            .exec();
        for (const conv of conversations) {
            await client.join(`conversation:${conv._id.toString()}`);
        }
    }
    handleDisconnect(client) {
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
    async handleSendMessage(client, payload) {
        const userId = this.socketUsers.get(client.id);
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }
        const { conversationId, content } = payload;
        if (!conversationId || !mongoose_2.Types.ObjectId.isValid(conversationId)) {
            return { success: false, error: 'Invalid conversation ID' };
        }
        if (!content || content.trim().length === 0) {
            return { success: false, error: 'Message content is required' };
        }
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }
        if (conversation.buyerId.toString() !== userId &&
            conversation.sellerId.toString() !== userId) {
            return { success: false, error: 'You are not a participant in this conversation' };
        }
        if (this.containsProhibitedContent(content)) {
            client.emit('messageBlocked', {
                conversationId,
                reason: 'Your message contains prohibited content and was not sent.',
            });
            return { success: false, error: 'Message contains prohibited content' };
        }
        const message = new this.messageModel({
            conversationId: conversation._id,
            senderId: new mongoose_2.Types.ObjectId(userId),
            content: content.trim(),
        });
        const savedMessage = await message.save();
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessageAt: savedMessage.createdAt,
            lastMessagePreview: preview,
        });
        this.server
            .to(`conversation:${conversationId}`)
            .emit('newMessage', savedMessage);
        const recipientId = conversation.buyerId.toString() === userId
            ? conversation.sellerId.toString()
            : conversation.buyerId.toString();
        if (!this.isUserOnline(recipientId)) {
            this.sendPushNotification(recipientId, conversationId, content).catch(() => {
            });
        }
        return { success: true, message: savedMessage };
    }
    async handleTyping(client, payload) {
        const userId = this.socketUsers.get(client.id);
        if (!userId)
            return;
        const { conversationId } = payload;
        if (!conversationId || !mongoose_2.Types.ObjectId.isValid(conversationId))
            return;
        client.to(`conversation:${conversationId}`).emit('userTyping', {
            conversationId,
            userId,
        });
    }
    async handleMarkRead(client, payload) {
        const userId = this.socketUsers.get(client.id);
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }
        const { conversationId, messageIds } = payload;
        if (!conversationId || !mongoose_2.Types.ObjectId.isValid(conversationId)) {
            return { success: false, error: 'Invalid conversation ID' };
        }
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return { success: false, error: 'No message IDs provided' };
        }
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
            return { success: false, error: 'Conversation not found' };
        }
        if (conversation.buyerId.toString() !== userId &&
            conversation.sellerId.toString() !== userId) {
            return { success: false, error: 'You are not a participant in this conversation' };
        }
        const validIds = messageIds
            .filter((id) => mongoose_2.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_2.Types.ObjectId(id));
        if (validIds.length === 0) {
            return { success: false, error: 'No valid message IDs' };
        }
        await this.messageModel.updateMany({
            _id: { $in: validIds },
            conversationId: new mongoose_2.Types.ObjectId(conversationId),
            senderId: { $ne: new mongoose_2.Types.ObjectId(userId) },
            isRead: false,
        }, { $set: { isRead: true } });
        this.server.to(`conversation:${conversationId}`).emit('messagesRead', {
            conversationId,
            messageIds: validIds.map((id) => id.toString()),
            readBy: userId,
        });
        return { success: true };
    }
    containsProhibitedContent(text) {
        const lowerText = text.toLowerCase();
        return PROHIBITED_WORDS.some((word) => lowerText.includes(word));
    }
    isUserOnline(userId) {
        const sockets = this.userSockets.get(userId);
        return !!sockets && sockets.size > 0;
    }
    async sendPushNotification(recipientId, conversationId, messageContent) {
        const user = await this.userModel.findById(recipientId).select('deviceTokens notificationPreferences').exec();
        if (!user)
            return;
        if (!user.notificationPreferences?.messages)
            return;
        const preview = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;
        console.log(`[Push Notification Stub] Sending to user ${recipientId} for conversation ${conversationId}: "${preview}"`);
    }
    async joinUserToRoom(userId, conversationId) {
        const socketIds = this.userSockets.get(userId);
        if (!socketIds)
            return;
        const room = `conversation:${conversationId}`;
        for (const socketId of socketIds) {
            try {
                const sockets = await this.server.fetchSockets();
                const socket = sockets.find(s => s.id === socketId);
                if (socket) {
                    socket.join(room);
                }
            }
            catch {
            }
        }
    }
};
exports.MessagingGateway = MessagingGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], MessagingGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagingGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagingGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('markRead'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], MessagingGateway.prototype, "handleMarkRead", null);
exports.MessagingGateway = MessagingGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/ws/messaging', cors: { origin: '*' } }),
    __param(0, (0, mongoose_1.InjectModel)(conversation_schema_js_1.Conversation.name)),
    __param(1, (0, mongoose_1.InjectModel)(message_schema_js_1.Message.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], MessagingGateway);
//# sourceMappingURL=messaging.gateway.js.map