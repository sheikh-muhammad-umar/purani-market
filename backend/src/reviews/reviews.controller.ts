import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateReviewDto } from './dto/create-review.dto.js';

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
  async getReviewsByListing(@Param('id') listingId: string) {
    return this.reviewsService.getReviewsByListing(listingId);
  }

  @Get('seller/:id')
  async getReviewsBySeller(@Param('id') sellerId: string) {
    return this.reviewsService.getReviewsBySeller(sellerId);
  }
}
