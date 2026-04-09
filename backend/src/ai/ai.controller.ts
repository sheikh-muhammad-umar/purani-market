import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecommendationService } from './recommendation.service.js';
import { ChatbotService } from './chatbot.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DismissRecommendationDto } from './dto/dismiss-recommendation.dto.js';
import { ChatbotMessageDto } from './dto/chatbot-message.dto.js';
import { TrackActivityDto } from './dto/track-activity.dto.js';
import { randomUUID } from 'crypto';

@Controller('api')
export class AiController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly chatbotService: ChatbotService,
  ) {}

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(
    @CurrentUser('sub') userId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLat = lat ? parseFloat(lat) : undefined;
    const parsedLng = lng ? parseFloat(lng) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    const listings = await this.recommendationService.getRecommendations(
      userId,
      parsedLat,
      parsedLng,
      parsedLimit,
    );

    return { data: listings };
  }

  @Post('recommendations/dismiss')
  @UseGuards(JwtAuthGuard)
  async dismissRecommendation(
    @CurrentUser('sub') userId: string,
    @Body() dto: DismissRecommendationDto,
  ) {
    await this.recommendationService.dismissRecommendation(
      userId,
      dto.productListingId,
    );
    return { message: 'Recommendation dismissed successfully' };
  }

  @Post('chatbot/message')
  async chatbotMessage(@Body() dto: ChatbotMessageDto) {
    const sessionId = dto.sessionId || randomUUID();
    const result = await this.chatbotService.processMessage(
      sessionId,
      dto.message,
    );

    return {
      sessionId,
      reply: result.reply,
      escalated: result.escalated,
    };
  }

  @Post('track')
  @UseGuards(JwtAuthGuard)
  async trackActivity(
    @CurrentUser('sub') userId: string,
    @Body() dto: TrackActivityDto,
    @Req() req: any,
  ) {
    await this.recommendationService.trackActivity(userId, dto.action, {
      productListingId: dto.productListingId,
      searchQuery: dto.searchQuery,
      categoryId: dto.categoryId,
      metadata: {
        ...dto.metadata,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
    return { tracked: true };
  }
}
