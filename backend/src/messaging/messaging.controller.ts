import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagingService } from './messaging.service.js';
import { MessagingGateway } from './messaging.gateway.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { ChatMediaService } from './chat-media.service.js';
import { MessageType } from './schemas/message.schema.js';
import { ERROR } from '../common/constants/error-messages.js';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
    private readonly chatMediaService: ChatMediaService,
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
    const saved = await this.messagingService.sendMessage(
      conversationId,
      userId,
      dto.content || '',
      {
        type: dto.type,
        location: dto.location,
      },
    );

    await this.emitToConversation(conversationId, saved);
    return saved;
  }

  @Post(':id/messages/image')
  @UseInterceptors(FileInterceptor('file'))
  async sendImageMessage(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException(ERROR.NO_IMAGE_FILE);

    const media = await this.chatMediaService.processImage(
      conversationId,
      file,
    );

    const saved = await this.messagingService.sendMessage(
      conversationId,
      userId,
      '',
      { type: MessageType.IMAGE, media },
    );

    await this.emitToConversation(conversationId, saved);
    return saved;
  }

  @Post(':id/messages/voice')
  @UseInterceptors(FileInterceptor('file'))
  async sendVoiceMessage(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('duration') duration?: string,
  ) {
    if (!file) throw new BadRequestException(ERROR.NO_AUDIO_FILE);

    const media = await this.chatMediaService.processVoiceNote(
      conversationId,
      file,
      duration ? parseFloat(duration) : undefined,
    );

    const saved = await this.messagingService.sendMessage(
      conversationId,
      userId,
      '',
      { type: MessageType.VOICE, media },
    );

    await this.emitToConversation(conversationId, saved);
    return saved;
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagingService.markConversationRead(conversationId, userId);
  }

  private async emitToConversation(
    conversationId: string,
    saved: any,
  ): Promise<void> {
    const conv =
      await this.messagingService.getConversationById(conversationId);
    if (conv) {
      await this.messagingGateway.joinUserToRoom(
        conv.buyerId.toString(),
        conversationId,
      );
      await this.messagingGateway.joinUserToRoom(
        conv.sellerId.toString(),
        conversationId,
      );
    }
    this.messagingGateway.server
      .to(`conversation:${conversationId}`)
      .emit('newMessage', saved);
  }
}
