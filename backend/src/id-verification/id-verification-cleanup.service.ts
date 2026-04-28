import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import {
  IdVerification,
  IdVerificationDocument,
  IdVerificationStatus,
} from './schemas/id-verification.schema.js';
import { ID_VERIFICATION_AUTO_EXPIRE_REASON } from '../common/constants/app.constants.js';

@Injectable()
export class IdVerificationCleanupService {
  private readonly logger = new Logger(IdVerificationCleanupService.name);
  private readonly staleDays: number;

  constructor(
    @InjectModel(IdVerification.name)
    private readonly verificationModel: Model<IdVerificationDocument>,
    private readonly configService: ConfigService,
  ) {
    this.staleDays = this.configService.get<number>(
      'idVerification.staleVerificationDays',
    )!;
  }

  // ─── Cron: Auto-expire stale pending ID verifications ───

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async expireStaleVerifications(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleDays * 24 * 60 * 60 * 1000);

    const result = await this.verificationModel
      .updateMany(
        {
          status: IdVerificationStatus.PENDING,
          createdAt: { $lte: cutoff },
        },
        {
          $set: {
            status: IdVerificationStatus.REJECTED,
            rejectionReason: ID_VERIFICATION_AUTO_EXPIRE_REASON,
          },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Auto-expired ${result.modifiedCount} stale pending ID verifications`,
      );
    }
    return result.modifiedCount;
  }
}
