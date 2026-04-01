import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagingService } from './messaging.service.js';
import { MessagingGateway } from './messaging.gateway.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Post()
  async createConversation(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.createConversation(userId, dto);
  }

  @Get()
  async getUserConversations(@CurrentUser('sub') userId: string) {
    return this.messagingService.getUserConversations(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    return this.messagingService.getUnreadCount(userId);
  }

  @Get('unread-per-conversation')
  async getUnreadPerConversation(@CurrentUser('sub') userId: string) {
    return this.messagingService.getUnreadPerConversation(userId);
  }

  @Get(':id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    return this.messagingService.getConversationMessages(
      conversationId,
      userId,
      pageNum > 0 ? pageNum : 1,
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    const saved = await this.messagingService.sendMessage(conversationId, userId, dto.content);

    // Ensure both participants are in the socket room
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

  @Post(':id/read')
  async markAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagingService.markConversationRead(conversationId, userId);
  }
}
