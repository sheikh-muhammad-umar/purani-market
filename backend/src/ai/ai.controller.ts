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
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DismissRecommendationDto } from './dto/dismiss-recommendation.dto.js';
import { ChatbotMessageDto } from './dto/chatbot-message.dto.js';
import { TrackActivityDto } from './dto/track-activity.dto.js';
import { randomUUID } from 'crypto';
import { UAParser } from 'ua-parser-js';

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
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const listings = await this.recommendationService.getRecommendations(
      userId,
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
  @UseGuards(OptionalJwtAuthGuard)
  async trackActivity(
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: TrackActivityDto,
    @Req() req: any,
  ) {
    const ua = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    const engine = parser.getEngine();

    const enrichedMetadata: Record<string, any> = {
      ...dto.metadata,
      browser: browser.name
        ? `${browser.name} ${browser.version || ''}`.trim()
        : undefined,
      os: os.name ? `${os.name} ${os.version || ''}`.trim() : undefined,
      deviceType: device.type || 'desktop',
      deviceVendor: device.vendor || undefined,
      deviceModel: device.model || undefined,
      engine: engine.name
        ? `${engine.name} ${engine.version || ''}`.trim()
        : undefined,
    };

    // Remove undefined values
    Object.keys(enrichedMetadata).forEach((k) => {
      if (enrichedMetadata[k] === undefined) delete enrichedMetadata[k];
    });

    await this.recommendationService.trackActivity(userId, dto.action, {
      productListingId: dto.productListingId,
      searchQuery: dto.searchQuery,
      categoryId: dto.categoryId,
      metadata: enrichedMetadata,
      ip,
      userAgent: ua,
    });
    return { tracked: true };
  }
}
