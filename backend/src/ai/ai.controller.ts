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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DismissRecommendationDto } from './dto/dismiss-recommendation.dto.js';
import { TrackActivityDto } from './dto/track-activity.dto.js';
import {
  boundedId,
  clientContext,
  deviceContext,
} from '../common/utils/request-context.js';

@Controller('api')
export class AiController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('recommendations')
  @UseGuards(OptionalJwtAuthGuard)
  async getRecommendations(
    @CurrentUser('sub') userId: string | undefined,
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

  @Post('track')
  @UseGuards(OptionalJwtAuthGuard)
  async trackActivity(
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: TrackActivityDto,
    @Req() req: any,
  ) {
    const { ip, userAgent } = clientContext(req);

    // Device facts are derived server-side rather than trusted from the client,
    // so they stay consistent across every event and cannot be spoofed.
    const enrichedMetadata: Record<string, any> = {
      ...dto.metadata,
      ...deviceContext(userAgent),
    };

    // Undefined keys would occupy space in the metadata map for no benefit.
    Object.keys(enrichedMetadata).forEach((k) => {
      if (enrichedMetadata[k] === undefined) delete enrichedMetadata[k];
    });

    await this.recommendationService.trackActivity(userId, dto.action, {
      productListingId: dto.productListingId,
      searchQuery: dto.searchQuery,
      categoryId: dto.categoryId,
      metadata: enrichedMetadata,
      ip,
      userAgent,
      sessionId: boundedId(dto.sessionId),
      visitorId: boundedId(dto.visitorId),
    });
    return { tracked: true };
  }
}
