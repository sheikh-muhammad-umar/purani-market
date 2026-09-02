import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { EngagementService, ItemEngagement } from './engagement.service.js';

/**
 * Engagement figures for the signed-in seller's own items.
 *
 * Scoped to the caller by `sellerId` in the query itself rather than by checking
 * ownership after the fact, so there is no route here that can return another
 * seller's numbers. How many people are chasing a listing is commercially
 * sensitive: a competitor could price against it.
 */
@Controller('api/engagement')
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Get('listings')
  async myListingEngagement(
    @CurrentUser('sub') userId: string,
  ): Promise<ItemEngagement[]> {
    return this.engagementService.getListingEngagement(userId);
  }

  @Get('shorts')
  async myShortsEngagement(
    @CurrentUser('sub') userId: string,
  ): Promise<ItemEngagement[]> {
    return this.engagementService.getShortsEngagement(userId);
  }
}
