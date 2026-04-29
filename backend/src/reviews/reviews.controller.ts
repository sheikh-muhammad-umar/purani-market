import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { MAX_REVIEWS_PER_PAGE } from '../common/constants/app.constants.js';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createReview(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(userId, dto);
  }

  @Get('listing/:id')
  async getReviewsByListing(
    @Param('id') listingId: string,
    @Query('limit', new DefaultValuePipe(MAX_REVIEWS_PER_PAGE), ParseIntPipe)
    limit: number,
  ) {
    const safeLimit = Math.min(Math.max(1, limit), MAX_REVIEWS_PER_PAGE);
    return this.reviewsService.getReviewsByListing(listingId, safeLimit);
  }

  @Get('seller/:id')
  async getReviewsBySeller(
    @Param('id') sellerId: string,
    @Query('limit', new DefaultValuePipe(MAX_REVIEWS_PER_PAGE), ParseIntPipe)
    limit: number,
  ) {
    const safeLimit = Math.min(Math.max(1, limit), MAX_REVIEWS_PER_PAGE);
    return this.reviewsService.getReviewsBySeller(sellerId, safeLimit);
  }
}
