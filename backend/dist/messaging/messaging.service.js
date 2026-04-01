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
exports.MessagingService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const conversation_schema_js_1 = require("./schemas/conversation.schema.js");
const message_schema_js_1 = require("./schemas/message.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
let MessagingService = class MessagingService {
    conversationModel;
    messageModel;
    listingModel;
    constructor(conversationModel, messageModel, listingModel) {
        this.conversationModel = conversationModel;
        this.messageModel = messageModel;
        this.listingModel = listingModel;
    }
    async createConversation(userId, dto) {
        const { productListingId, message } = dto;
        if (!mongoose_2.Types.ObjectId.isValid(productListingId)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(productListingId).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        if (listing.sellerId.toString() === userId) {
            throw new common_1.BadRequestException('You cannot start a conversation on your own listing');
        }
        const buyerId = new mongoose_2.Types.ObjectId(userId);
        const sellerId = listing.sellerId;
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
        let savedMessage;
        if (message) {
            savedMessage = new this.messageModel({
                conversationId: conversation._id,
                senderId: buyerId,
                content: message,
            });
            await savedMessage.save();
            conversation.lastMessageAt = savedMessage.createdAt;
            conversation.lastMessagePreview =
                message.length > 100 ? message.substring(0, 100) + '...' : message;
            await conversation.save();
        }
        return { conversation, message: savedMessage };
    }
    async getUserConversations(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
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
    async getConversationMessages(conversationId, userId, page = 1) {
        if (!mongoose_2.Types.ObjectId.isValid(conversationId)) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const conversation = await this.conversationModel
            .findById(conversationId)
            .exec();
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const userObjectId = userId;
        if (conversation.buyerId.toString() !== userObjectId &&
            conversation.sellerId.toString() !== userObjectId) {
            throw new common_1.ForbiddenException('You are not a participant in this conversation');
        }
        const limit = 20;
        const skip = (page - 1) * limit;
        const [messages, total] = await Promise.all([
            this.messageModel
                .find({ conversationId: conversation._id })
                .populate('senderId', 'profile.firstName profile.lastName profile.avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.messageModel.countDocuments({ conversationId: conversation._id }).exec(),
        ]);
        return {
            messages,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async sendMessage(conversationId, userId, content) {
        if (!mongoose_2.Types.ObjectId.isValid(conversationId)) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        if (conversation.buyerId.toString() !== userId &&
            conversation.sellerId.toString() !== userId) {
            throw new common_1.ForbiddenException('You are not a participant in this conversation');
        }
        const message = new this.messageModel({
            conversationId: conversation._id,
            senderId: new mongoose_2.Types.ObjectId(userId),
            content: content.trim(),
        });
        const saved = await message.save();
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessageAt: saved.createdAt,
            lastMessagePreview: preview,
        });
        return saved;
    }
    async getUnreadCount(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const conversations = await this.conversationModel
            .find({ $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }] })
            .select('_id')
            .exec();
        const conversationIds = conversations.map(c => c._id);
        const count = await this.messageModel.countDocuments({
            conversationId: { $in: conversationIds },
            senderId: { $ne: userObjectId },
            isRead: false,
        }).exec();
        return { count };
    }
    async getConversationById(conversationId) {
        if (!mongoose_2.Types.ObjectId.isValid(conversationId))
            return null;
        return this.conversationModel.findById(conversationId).exec();
    }
    async markConversationRead(conversationId, userId) {
        if (!mongoose_2.Types.ObjectId.isValid(conversationId)) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        if (conversation.buyerId.toString() !== userId &&
            conversation.sellerId.toString() !== userId) {
            throw new common_1.ForbiddenException('You are not a participant in this conversation');
        }
        const result = await this.messageModel.updateMany({
            conversationId: conversation._id,
            senderId: { $ne: new mongoose_2.Types.ObjectId(userId) },
            isRead: false,
        }, { $set: { isRead: true } }).exec();
        return { marked: result.modifiedCount };
    }
    async getUnreadPerConversation(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        const conversations = await this.conversationModel
            .find({ $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }] })
            .select('_id')
            .exec();
        const counts = {};
        for (const conv of conversations) {
            const count = await this.messageModel.countDocuments({
                conversationId: conv._id,
                senderId: { $ne: userObjectId },
                isRead: false,
            }).exec();
            if (count > 0) {
                counts[conv._id.toString()] = count;
            }
        }
        return counts;
    }
};
exports.MessagingService = MessagingService;
exports.MessagingService = MessagingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(conversation_schema_js_1.Conversation.name)),
    __param(1, (0, mongoose_1.InjectModel)(message_schema_js_1.Message.name)),
    __param(2, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], MessagingService);
//# sourceMappingURL=messaging.service.js.map