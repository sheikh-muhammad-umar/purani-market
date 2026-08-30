import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserActivity,
  UserActivityDocument,
  UserAction,
} from './schemas/user-activity.schema.js';
import { clientContext } from '../common/utils/request-context.js';

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
    const { ip, userAgent } = clientContext(req);

    await new this.activityModel({
      userId: new Types.ObjectId(adminUserId),
      action,
      metadata: new Map(Object.entries(metadata)),
      ip,
      userAgent,
    }).save();
  }
}
