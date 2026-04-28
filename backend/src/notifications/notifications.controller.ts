import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../common/guards/index.js';
import { Roles, CurrentUser } from '../common/decorators/index.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { BroadcastService } from './broadcast.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { NotificationStatus } from './schemas/notification.schema.js';

// ── User endpoints ──────────────────────────────────────────────

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class UserNotificationsController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get()
  async getMyNotifications(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.broadcastService.getUserNotifications(
      userId,
      page,
      limit,
      unreadOnly === 'true',
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.broadcastService.markAsRead(userId, id);
    return { success: true };
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.broadcastService.markAllAsRead(userId);
  }
}

// ── Admin endpoints ─────────────────────────────────────────────

@Controller('api/admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNotificationsController {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Post('send')
  async sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const notification = await this.broadcastService.createAndSend(
      dto,
      adminId,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_NOTIFICATION_SEND,
      {
        notificationId: notification._id.toString(),
        title: dto.title,
        channel: dto.channel,
        audience: dto.audience,
      },
      req,
    );
    return {
      message: 'Notification is being sent',
      notificationId: notification._id,
    };
  }

  @Get()
  async listNotifications(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: NotificationStatus,
  ) {
    return this.broadcastService.listNotifications(page, limit, status);
  }

  @Get(':id')
  async getNotification(@Param('id') id: string) {
    return this.broadcastService.findById(id);
  }
}
