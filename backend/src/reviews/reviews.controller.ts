import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard, RolesGuard } from '../common/guards/index.js';
import { Roles, CurrentUser } from '../common/decorators/index.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ModerateReviewDto } from './dto/moderate-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { ReviewStatus } from './schemas/review.schema.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import {
  MAX_REVIEWS_PER_PAGE,
  MAX_REVIEW_IMAGES,
} from '../common/constants/app.constants.js';
import { ERROR } from '../common/constants/error-messages.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_REGEX = /^image\/(jpeg|png|webp)$/;

@Controller('api/reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_REVIEW_IMAGES, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_REGEX.test(file.mimetype)) {
          cb(new BadRequestException(ERROR.REVIEW_INVALID_IMAGE_TYPE), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async createReview(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() images: Express.Multer.File[] = [],
    @Req() req: any,
  ) {
    const review = await this.reviewsService.createReview(userId, dto, images);

    this.tracker.track(
      userId,
      UserAction.REVIEW_CREATE,
      {
        reviewId: review._id.toString(),
        sellerId: review.sellerId.toString(),
        productListingId: dto.productListingId,
        rating: dto.rating,
        hasImages: images.length > 0,
      },
      req,
    );

    return review;
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

  // ── Admin: moderation queue ───────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllReviews(@Query() query: ListReviewsQueryDto) {
    return this.reviewsService.getAllReviews({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getReviewDetail(@Param('id') id: string) {
    return this.reviewsService.getReviewById(id);
  }

  /**
   * Moderate a pending review. Approve publishes it; reject deletes it
   * outright. Either way the reviewer is notified.
   */
  @Patch('admin/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async moderateReview(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ModerateReviewDto,
    @Req() req: any,
  ) {
    if (dto.status === ReviewStatus.APPROVED) {
      const review = await this.reviewsService.approveReview(id, adminId);
      this.tracker.track(
        adminId,
        UserAction.ADMIN_REVIEW_APPROVE,
        { reviewId: id, sellerId: review.sellerId.toString() },
        req,
      );
      return review;
    }

    const result = await this.reviewsService.rejectReview(
      id,
      adminId,
      dto.moderationNote,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REVIEW_REJECT,
      { reviewId: id, deleted: result.deleted },
      req,
    );
    return result;
  }
}
