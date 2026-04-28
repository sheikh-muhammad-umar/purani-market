import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
} from './schemas/review.schema.js';

@Injectable()
export class ReviewsCleanupService {
  private readonly logger = new Logger(ReviewsCleanupService.name);
  private readonly staleDays: number;

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly configService: ConfigService,
  ) {
    this.staleDays = this.configService.get<number>(
      'review.stalePendingModerationDays',
    )!;
  }

  // ─── Cron: Auto-approve stale pending reviews ───

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async autoApproveStaleReviews(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleDays * 24 * 60 * 60 * 1000);

    const result = await this.reviewModel
      .updateMany(
        {
          status: ReviewStatus.PENDING,
          createdAt: { $lte: cutoff },
        },
        { $set: { status: ReviewStatus.APPROVED } },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Auto-approved ${result.modifiedCount} stale pending reviews`,
      );
    }
    return result.modifiedCount;
  }
}
