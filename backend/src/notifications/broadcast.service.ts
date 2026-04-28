import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationStatus,
  NotificationAudience,
  NotificationChannel,
  DEFAULT_NOTIFICATION_CATEGORY,
  BROADCAST_DATA_TYPE,
} from './schemas/notification.schema.js';
import {
  UserNotification,
  UserNotificationDocument,
} from './schemas/user-notification.schema.js';
import {
  User,
  UserDocument,
  UserStatus,
} from '../users/schemas/user.schema.js';
import {
  NotificationsService,
  NotificationType,
} from './notifications.service.js';
import { EmailService } from '../auth/services/email.service.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';

const BATCH_SIZE = 100;

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(UserNotification.name)
    private readonly userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async createAndSend(
    dto: SendNotificationDto,
    adminId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.create({
      title: dto.title,
      body: dto.body,
      htmlBody: dto.htmlBody,
      channel: dto.channel,
      audience: dto.audience,
      targetRole: dto.targetRole,
      targetUserIds: dto.targetUserIds?.map((id) => new Types.ObjectId(id)),
      category: dto.category || DEFAULT_NOTIFICATION_CATEGORY,
      status: NotificationStatus.SENDING,
      sentBy: new Types.ObjectId(adminId),
      sentAt: new Date(),
    });

    // Process in background — don't block the response
    this.processNotification(notification).catch((err) =>
      this.logger.error(
        `Broadcast failed for ${notification._id}: ${(err as Error).message}`,
      ),
    );

    return notification;
  }

  async listNotifications(
    page = 1,
    limit = 20,
    status?: NotificationStatus,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [rawData, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    // Enrich with live read counts
    const notificationIds = rawData.map((n: any) => n._id);
    const readCounts = await this.userNotificationModel
      .aggregate([
        { $match: { notificationId: { $in: notificationIds }, read: true } },
        { $group: { _id: '$notificationId', count: { $sum: 1 } } },
      ])
      .exec();

    const readCountMap = new Map(
      readCounts.map((r: any) => [r._id.toString(), r.count]),
    );

    const data = rawData.map((n: any) => ({
      ...n,
      readCount: readCountMap.get(n._id.toString()) || 0,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<any> {
    const notification = await this.notificationModel
      .findById(id)
      .lean()
      .exec();
    if (!notification) throw new NotFoundException('Notification not found');

    const readCount = await this.userNotificationModel
      .countDocuments({
        notificationId: new Types.ObjectId(id),
        read: true,
      })
      .exec();

    return { ...notification, readCount };
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<{
    data: UserNotificationDocument[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const userObjId = new Types.ObjectId(userId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filter: Record<string, any> = {
      userId: userObjId,
      createdAt: { $gte: thirtyDaysAgo },
    };
    if (unreadOnly) filter.read = false;

    const skip = (page - 1) * limit;
    const [data, total, unreadCount] = await Promise.all([
      this.userNotificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userNotificationModel.countDocuments(filter).exec(),
      this.userNotificationModel
        .countDocuments({
          userId: userObjId,
          read: false,
          createdAt: { $gte: thirtyDaysAgo },
        })
        .exec(),
    ]);

    return {
      data: data as UserNotificationDocument[],
      total,
      unreadCount,
      page,
      limit,
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.userNotificationModel
      .updateOne(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        { read: true },
      )
      .exec();
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.userNotificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { read: true },
      )
      .exec();
    return { updated: result.modifiedCount };
  }

  // ── Internal processing ───────────────────────────────────────

  private async processNotification(
    notification: NotificationDocument,
  ): Promise<void> {
    try {
      const users = await this.resolveRecipients(notification);

      await this.notificationModel
        .updateOne({ _id: notification._id }, { recipientCount: users.length })
        .exec();

      // Create user notification records in batches
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map((user) => this.deliverToUser(notification, user)),
        );
      }

      await this.notificationModel
        .updateOne(
          { _id: notification._id },
          { status: NotificationStatus.SENT },
        )
        .exec();

      this.logger.log(
        `Broadcast ${notification._id}: sent to ${users.length} recipients`,
      );
    } catch (error) {
      await this.notificationModel
        .updateOne(
          { _id: notification._id },
          { status: NotificationStatus.FAILED },
        )
        .exec();
      throw error;
    }
  }

  private async resolveRecipients(
    notification: NotificationDocument,
  ): Promise<UserDocument[]> {
    const filter: Record<string, any> = { status: UserStatus.ACTIVE };

    switch (notification.audience) {
      case NotificationAudience.ALL:
        break;
      case NotificationAudience.ROLE:
        if (notification.targetRole) {
          filter.role = notification.targetRole;
        }
        break;
      case NotificationAudience.SPECIFIC:
        if (notification.targetUserIds?.length) {
          filter._id = { $in: notification.targetUserIds };
        }
        break;
    }

    return this.userModel.find(filter).exec();
  }

  private async deliverToUser(
    notification: NotificationDocument,
    user: UserDocument,
  ): Promise<boolean> {
    const category = notification.category as NotificationType;

    // Check user preferences
    if (!this.notificationsService.isNotificationEnabled(user, category)) {
      return false;
    }

    // Create user notification record
    await this.userNotificationModel.create({
      userId: user._id,
      notificationId: notification._id,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      channel: notification.channel,
    });

    let pushSent = false;
    let emailSent = false;

    // Send push notification
    if (
      notification.channel === NotificationChannel.PUSH ||
      notification.channel === NotificationChannel.BOTH
    ) {
      pushSent = await this.notificationsService.sendToUser(
        user._id.toString(),
        category,
        {
          title: notification.title,
          body: notification.body,
          data: {
            type: BROADCAST_DATA_TYPE,
            notificationId: notification._id.toString(),
          },
        },
      );
    }

    // Send email
    if (
      notification.channel === NotificationChannel.EMAIL ||
      notification.channel === NotificationChannel.BOTH
    ) {
      if (user.email) {
        try {
          await this.emailService.sendBroadcastEmail(
            user.email,
            notification.title,
            notification.htmlBody || notification.body,
          );
          emailSent = true;
        } catch {
          emailSent = false;
        }
      }
    }

    return pushSent || emailSent;
  }
}
