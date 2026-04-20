import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserActivity, UserActivityDocument, UserAction } from './schemas/user-activity.schema.js';

@Injectable()
export class AdminTrackerService {
  constructor(
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivityDocument>,
  ) {}

  async track(
    adminUserId: string,
    action: UserAction,
    metadata: Record<string, any> = {},
    req?: any,
  ): Promise<void> {
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip;
    const userAgent = req?.headers?.['user-agent'];

    await new this.activityModel({
      userId: new Types.ObjectId(adminUserId),
      action,
      metadata: new Map(Object.entries(metadata)),
      ip,
      userAgent,
    }).save();
  }
}
