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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const recommendation_service_js_1 = require("./recommendation.service.js");
const chatbot_service_js_1 = require("./chatbot.service.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const dismiss_recommendation_dto_js_1 = require("./dto/dismiss-recommendation.dto.js");
const chatbot_message_dto_js_1 = require("./dto/chatbot-message.dto.js");
const crypto_1 = require("crypto");
let AiController = class AiController {
    recommendationService;
    chatbotService;
    constructor(recommendationService, chatbotService) {
        this.recommendationService = recommendationService;
        this.chatbotService = chatbotService;
    }
    async getRecommendations(userId, lat, lng, limit) {
        const parsedLat = lat ? parseFloat(lat) : undefined;
        const parsedLng = lng ? parseFloat(lng) : undefined;
        const parsedLimit = limit ? parseInt(limit, 10) : undefined;
        const listings = await this.recommendationService.getRecommendations(userId, parsedLat, parsedLng, parsedLimit);
        return { data: listings };
    }
    async dismissRecommendation(userId, dto) {
        await this.recommendationService.dismissRecommendation(userId, dto.productListingId);
        return { message: 'Recommendation dismissed successfully' };
    }
    async chatbotMessage(dto) {
        const sessionId = dto.sessionId || (0, crypto_1.randomUUID)();
        const result = await this.chatbotService.processMessage(sessionId, dto.message);
        return {
            sessionId,
            reply: result.reply,
            escalated: result.escalated,
        };
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)('lat')),
    __param(2, (0, common_1.Query)('lng')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Post)('recommendations/dismiss'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dismiss_recommendation_dto_js_1.DismissRecommendationDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "dismissRecommendation", null);
__decorate([
    (0, common_1.Post)('chatbot/message'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_message_dto_js_1.ChatbotMessageDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "chatbotMessage", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [recommendation_service_js_1.RecommendationService,
        chatbot_service_js_1.ChatbotService])
], AiController);
//# sourceMappingURL=ai.controller.js.map