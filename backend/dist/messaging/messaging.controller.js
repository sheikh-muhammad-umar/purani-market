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
exports.MessagingController = void 0;
const common_1 = require("@nestjs/common");
const messaging_service_js_1 = require("./messaging.service.js");
const messaging_gateway_js_1 = require("./messaging.gateway.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const create_conversation_dto_js_1 = require("./dto/create-conversation.dto.js");
const send_message_dto_js_1 = require("./dto/send-message.dto.js");
let MessagingController = class MessagingController {
    messagingService;
    messagingGateway;
    constructor(messagingService, messagingGateway) {
        this.messagingService = messagingService;
        this.messagingGateway = messagingGateway;
    }
    async createConversation(userId, dto) {
        return this.messagingService.createConversation(userId, dto);
    }
    async getUserConversations(userId) {
        return this.messagingService.getUserConversations(userId);
    }
    async getUnreadCount(userId) {
        return this.messagingService.getUnreadCount(userId);
    }
    async getUnreadPerConversation(userId) {
        return this.messagingService.getUnreadPerConversation(userId);
    }
    async getConversationMessages(conversationId, userId, page) {
        const pageNum = page ? parseInt(page, 10) : 1;
        return this.messagingService.getConversationMessages(conversationId, userId, pageNum > 0 ? pageNum : 1);
    }
    async sendMessage(conversationId, userId, dto) {
        const saved = await this.messagingService.sendMessage(conversationId, userId, dto.content);
        const conv = await this.messagingService.getConversationById(conversationId);
        if (conv) {
            await this.messagingGateway.joinUserToRoom(conv.buyerId.toString(), conversationId);
            await this.messagingGateway.joinUserToRoom(conv.sellerId.toString(), conversationId);
        }
        this.messagingGateway.server
            .to(`conversation:${conversationId}`)
            .emit('newMessage', saved);
        return saved;
    }
    async markAsRead(conversationId, userId) {
        return this.messagingService.markConversationRead(conversationId, userId);
    }
};
exports.MessagingController = MessagingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_conversation_dto_js_1.CreateConversationDto]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "getUserConversations", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)('unread-per-conversation'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "getUnreadPerConversation", null);
__decorate([
    (0, common_1.Get)(':id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "getConversationMessages", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, send_message_dto_js_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessagingController.prototype, "markAsRead", null);
exports.MessagingController = MessagingController = __decorate([
    (0, common_1.Controller)('api/conversations'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __metadata("design:paramtypes", [messaging_service_js_1.MessagingService,
        messaging_gateway_js_1.MessagingGateway])
], MessagingController);
//# sourceMappingURL=messaging.controller.js.map