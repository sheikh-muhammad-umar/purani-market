import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema.js';

@Injectable()
export class MessagingCleanupService {
  private readonly logger = new Logger(MessagingCleanupService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  // ─── Cron: Expire live location shares ───

  @Cron(CronExpression.EVERY_HOUR)
  async expireLiveLocations(): Promise<number> {
    const now = new Date();

    const result = await this.messageModel
      .updateMany(
        {
          'location.isLive': true,
          'location.expiresAt': { $lte: now },
        },
        {
          $set: { 'location.isLive': false },
        },
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`Expired ${result.modifiedCount} live location shares`);
    }
    return result.modifiedCount;
  }
}
