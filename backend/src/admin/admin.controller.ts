import {
  Controller,
  Get,
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
import { Roles, CurrentUser, Permissions } from '../common/decorators/index.js';
import { UserRole, Permission } from '../users/schemas/user.schema.js';
import { AdminService } from './admin.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateAdLimitDto } from './dto/update-ad-limit.dto.js';
import { RejectListingDto } from './dto/reject-listing.dto.js';
import { UpdatePermissionsDto } from './dto/update-permissions.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    const result = await this.adminService.listUsers(query);

    // Enrich each user with activity summary and active packages
    const enrichedData = await Promise.all(
      result.data.map(async (user: any) => {
        const [activity, activePackages] = await Promise.all([
          this.adminService.getUserActivitySummary(user._id.toString()),
          this.adminService.getUserActivePackages(user._id.toString()),
        ]);
        return { ...user, activitySummary: activity, activePackages };
      }),
    );

    return { ...result, data: enrichedData };
  }

  @Get('users/:id/activity')
  async getUserActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.getUserActivityLog(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      action,
    );
  }

  @Get('activity')
  async getAllActivity(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.adminService.getAllActivityLog({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action, userId, dateFrom, dateTo, sort, order,
    });
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const user = await this.adminService.updateUserStatus(id, dto.status);
    this.tracker.track(adminId, UserAction.ADMIN_USER_STATUS_CHANGE, { targetUserId: id, newStatus: dto.status }, req);
    return { message: `User status updated to ${dto.status}`, userId: user._id };
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const user = await this.adminService.updateUserRole(id, dto.role);
    this.tracker.track(adminId, UserAction.ADMIN_USER_ROLE_CHANGE, { targetUserId: id, newRole: dto.role }, req);
    return { message: `User role updated to ${dto.role}`, userId: user._id };
  }

  @Patch('users/:id/ad-limit')
  async updateAdLimit(
    @Param('id') id: string,
    @Body() dto: UpdateAdLimitDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const user = await this.adminService.updateAdLimit(id, dto.adLimit);
    this.tracker.track(adminId, UserAction.ADMIN_USER_AD_LIMIT_CHANGE, { targetUserId: id, newAdLimit: dto.adLimit }, req);
    return {
      message: `Ad limit updated to ${dto.adLimit}`,
      userId: user._id,
      adLimit: user.adLimit,
    };
  }

  @Get('listings/pending')
  async getPendingListings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getPendingListings(page, limit);
  }

  @Patch('listings/:id/approve')
  async approveListing(@Param('id') id: string, @CurrentUser('sub') adminId: string, @Req() req: any) {
    const listing = await this.adminService.approveListing(id);
    this.tracker.track(adminId, UserAction.ADMIN_LISTING_APPROVE, { listingId: id, title: listing.title }, req);
    return { message: 'Listing approved', listingId: listing._id, status: listing.status };
  }

  @Patch('listings/:id/reject')
  async rejectListing(
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const listing = await this.adminService.rejectListing(id, dto.rejectionReason);
    this.tracker.track(adminId, UserAction.ADMIN_LISTING_REJECT, { listingId: id, title: listing.title, reason: dto.rejectionReason }, req);
    return { message: 'Listing rejected', listingId: listing._id, status: listing.status, rejectionReason: listing.rejectionReason };
  }

  @Get('analytics')
  async getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/export')
  async exportAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser('sub') adminId?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const from = dateFrom || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const to = dateTo || now.toISOString().split('T')[0];
    if (adminId) this.tracker.track(adminId, UserAction.ADMIN_EXPORT_REPORT, { dateFrom: from, dateTo: to }, req);
    return this.adminService.exportAnalytics(from, to);
  }

  @Get('packages/purchases')
  async listPackagePurchases(@Query() query: ListPurchasesQueryDto) {
    return this.adminService.listPackagePurchases(query);
  }

  @Get('payments')
  async listPayments(@Query() query: ListPaymentsQueryDto) {
    return this.adminService.listPayments(query);
  }

  @Get('sellers/:id/ad-info')
  async getSellerAdInfo(@Param('id') id: string) {
    return this.adminService.getSellerAdInfo(id);
  }

  // ── Permission Management (super_admin or roles:manage) ──────────

  @Get('permissions')
  @Roles(UserRole.SUPER_ADMIN)
  async listPermissions() {
    return {
      permissions: Object.entries(Permission).map(([key, value]) => ({
        key,
        value,
        group: value.split(':')[0],
        action: value.split(':')[1],
      })),
    };
  }

  @Patch('users/:id/permissions')
  @Roles(UserRole.SUPER_ADMIN)
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const user = await this.adminService.updatePermissions(id, dto.permissions);
    this.tracker.track(adminId, UserAction.ADMIN_USER_ROLE_CHANGE, {
      targetUserId: id,
      action: 'permissions_update',
      permissions: dto.permissions.join(', '),
    }, req);
    return { message: 'Permissions updated', userId: user._id, permissions: user.permissions };
  }
}
