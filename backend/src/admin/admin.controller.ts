import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  forwardRef,
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
import { UpdateListingLimitDto } from './dto/update-listing-limit.dto.js';
import { RejectListingDto } from './dto/reject-listing.dto.js';
import { UpdatePermissionsDto } from './dto/update-permissions.dto.js';
import { CreateRejectionReasonDto } from './dto/create-rejection-reason.dto.js';
import { UpdateRejectionReasonDto } from './dto/update-rejection-reason.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { RefundPurchaseDto } from './dto/refund-purchase.dto.js';
import { PackagesService } from '../packages/packages.service.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly tracker: AdminTrackerService,
    @Inject(forwardRef(() => PackagesService))
    private readonly packagesService: PackagesService,
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
      action,
      userId,
      dateFrom,
      dateTo,
      sort,
      order,
    });
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldUser = await this.adminService.findUserById(id);
    const previousStatus = oldUser.status;
    const user = await this.adminService.updateUserStatus(id, dto.status);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_USER_STATUS_CHANGE,
      { targetUserId: id, previousStatus, newStatus: dto.status },
      req,
    );
    return {
      message: `User status updated to ${dto.status}`,
      userId: user._id,
    };
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('sub') adminId: string,
    @CurrentUser('role') adminRole: UserRole,
    @Req() req: any,
  ) {
    const oldUser = await this.adminService.findUserById(id);
    const previousRole = oldUser.role;
    // The acting admin is passed through so the service can refuse a
    // self-promotion or an attempt on a super-admin. The role comes from the
    // JWT strategy, which re-reads it from the database on every request.
    const user = await this.adminService.updateUserRole(id, dto.role, {
      id: adminId,
      role: adminRole,
    });
    this.tracker.track(
      adminId,
      UserAction.ADMIN_USER_ROLE_CHANGE,
      { targetUserId: id, previousRole, newRole: dto.role },
      req,
    );
    return { message: `User role updated to ${dto.role}`, userId: user._id };
  }

  @Patch('users/:id/listing-limit')
  async updateListingLimit(
    @Param('id') id: string,
    @Body() dto: UpdateListingLimitDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldUser = await this.adminService.findUserById(id);
    const previousListingLimit = oldUser.listingLimit;
    const user = await this.adminService.updateListingLimit(
      id,
      dto.listingLimit,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_USER_LISTING_LIMIT_CHANGE,
      {
        targetUserId: id,
        previousListingLimit,
        newListingLimit: dto.listingLimit,
      },
      req,
    );
    return {
      message: `Listing limit updated to ${dto.listingLimit}`,
      userId: user._id,
      listingLimit: user.listingLimit,
    };
  }

  @Get('listings/pending')
  async getPendingListings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getPendingListings(page, limit);
  }

  @Get('listings/all')
  async getAllListings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('rejectionReason') rejectionReason?: string,
    @Query('deletionReason') deletionReason?: string,
  ) {
    return this.adminService.getAllListings({
      page,
      limit,
      search,
      status,
      categoryId,
      provinceId,
      cityId,
      dateFrom,
      dateTo,
      sort,
      order,
      rejectionReason,
      deletionReason,
    });
  }

  @Patch('listings/:id/approve')
  async approveListing(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldListing = await this.adminService.findListingById(id);
    const previousStatus = oldListing.status;
    const listing = await this.adminService.approveListing(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LISTING_APPROVE,
      {
        listingId: id,
        title: listing.title,
        previousStatus,
        newStatus: listing.status,
      },
      req,
    );
    return {
      message: 'Listing approved',
      listingId: listing._id,
      status: listing.status,
    };
  }

  @Patch('listings/:id/reject')
  async rejectListing(
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldListing = await this.adminService.findListingById(id);
    const previousStatus = oldListing.status;
    const listing = await this.adminService.rejectListing(
      id,
      dto.rejectionReasonIds,
      dto.customNote,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LISTING_REJECT,
      {
        listingId: id,
        title: listing.title,
        previousStatus,
        newStatus: listing.status,
        reasons: dto.rejectionReasonIds,
        note: dto.customNote,
      },
      req,
    );
    return {
      message: 'Listing rejected',
      listingId: listing._id,
      status: listing.status,
      rejectionReason: listing.rejectionReason,
    };
  }

  @Get('analytics')
  async getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/app-banner')
  async getAppBannerStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAppBannerStats(dateFrom, dateTo);
  }

  @Get('analytics/price-trends')
  async getPriceTrends(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getCategoryPriceTrends(dateFrom, dateTo);
  }

  @Get('analytics/engagement')
  async getEngagementAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getEngagementAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/voice-search')
  async getVoiceSearchAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getVoiceSearchAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/social-logins')
  async getSocialLoginAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getSocialLoginAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/otp')
  async getOtpAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getOtpAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/behaviour')
  async getBehaviourAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getBehaviourAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/listing-funnel')
  async getListingFunnelAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getListingFunnelAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/traffic')
  async getTrafficAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getTrafficAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/retention')
  async getRetentionAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getUserRetentionAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/revenue')
  async getRevenueAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getRevenueAnalytics(dateFrom, dateTo);
  }

  @Get('analytics/export')
  async exportAnalytics(
    @Res() res: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser('sub') adminId?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const from =
      dateFrom ||
      new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        .toISOString()
        .split('T')[0];
    const to = dateTo || now.toISOString().split('T')[0];
    if (adminId)
      this.tracker.track(
        adminId,
        UserAction.ADMIN_EXPORT_REPORT,
        { dateFrom: from, dateTo: to },
        req,
      );

    const report = await this.adminService.exportAnalytics(from, to);
    const csv = this.adminService.buildAnalyticsCsv(report);

    // Sent through @Res() so it bypasses the global TransformInterceptor: an
    // export has to be the file itself, not a file wrapped in a JSON envelope.
    // The BOM keeps Excel from mangling non-ASCII titles.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${from}-to-${to}.csv"`,
    );
    return res.send('\uFEFF' + csv);
  }

  @Get('packages/purchases')
  async listPackagePurchases(@Query() query: ListPurchasesQueryDto) {
    return this.adminService.listPackagePurchases(query);
  }

  /**
   * Refunds a package purchase.
   *
   * Records it and withdraws the unused allowance; returning the money itself
   * happens in the gateway. See `PackagesService.refundPurchase`.
   */
  @Post('packages/purchases/:id/refund')
  async refundPurchase(
    @Param('id') id: string,
    @Body() dto: RefundPurchaseDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.packagesService.refundPurchase(id, adminId, dto.reason);
  }

  @Get('payments')
  async listPayments(@Query() query: ListPaymentsQueryDto) {
    return this.adminService.listPayments(query);
  }

  @Get('sellers/:id/ad-info')
  async getSellerAdInfo(@Param('id') id: string) {
    return this.adminService.getSellerAdInfo(id);
  }

  // ── Rejection Reasons (super_admin CRUD, admin read) ──────────

  @Get('rejection-reasons')
  async getRejectionReasons(@Query('all') all?: string) {
    return this.adminService.getRejectionReasons(all !== 'true');
  }

  @Post('rejection-reasons')
  @Roles(UserRole.SUPER_ADMIN)
  async createRejectionReason(
    @Body() dto: CreateRejectionReasonDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const reason = await this.adminService.createRejectionReason(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_CREATE,
      { title: dto.title },
      req,
    );
    return reason;
  }

  @Patch('rejection-reasons/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateRejectionReason(
    @Param('id') id: string,
    @Body() dto: UpdateRejectionReasonDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldReason = await this.adminService.findRejectionReasonById(id);
    const reason = await this.adminService.updateRejectionReason(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_UPDATE,
      {
        id,
        previousTitle: oldReason.title,
        previousIsActive: oldReason.isActive,
        changes: dto,
      },
      req,
    );
    return reason;
  }

  @Delete('rejection-reasons/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteRejectionReason(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldReason = await this.adminService.findRejectionReasonById(id);
    await this.adminService.deleteRejectionReason(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_DELETE,
      { id, title: oldReason.title },
      req,
    );
    return { deleted: true };
  }

  // ── Permission Management (super_admin or roles:manage) ──────────

  @Get('deletion-reasons')
  async getDeletionReasons(@Query('all') all?: string) {
    return this.adminService.getDeletionReasons(all !== 'true');
  }

  @Post('deletion-reasons')
  @Roles(UserRole.SUPER_ADMIN)
  async createDeletionReason(
    @Body() dto: CreateRejectionReasonDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const reason = await this.adminService.createDeletionReason(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_CREATE,
      { type: 'deletion_reason', title: dto.title },
      req,
    );
    return reason;
  }

  @Patch('deletion-reasons/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateDeletionReason(
    @Param('id') id: string,
    @Body() dto: UpdateRejectionReasonDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldReason = await this.adminService.findDeletionReasonById(id);
    const reason = await this.adminService.updateDeletionReason(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_UPDATE,
      {
        type: 'deletion_reason',
        id,
        previousTitle: oldReason.title,
        previousIsActive: oldReason.isActive,
        changes: dto,
      },
      req,
    );
    return reason;
  }

  @Delete('deletion-reasons/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteDeletionReason(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldReason = await this.adminService.findDeletionReasonById(id);
    await this.adminService.deleteDeletionReason(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_REJECTION_REASON_DELETE,
      { type: 'deletion_reason', id, title: oldReason.title },
      req,
    );
    return { deleted: true };
  }

  // ── Permission Management (super_admin or roles:manage) ──────────

  @Get('permissions')
  @Roles(UserRole.SUPER_ADMIN)
  listPermissions() {
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
    const oldUser = await this.adminService.findUserById(id);
    const previousPermissions = [...(oldUser.permissions ?? [])];
    const user = await this.adminService.updatePermissions(id, dto.permissions);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_USER_ROLE_CHANGE,
      {
        targetUserId: id,
        action: 'permissions_update',
        previousPermissions: previousPermissions.join(', '),
        newPermissions: dto.permissions.join(', '),
      },
      req,
    );
    return {
      message: 'Permissions updated',
      userId: user._id,
      permissions: user.permissions,
    };
  }

  @Get('id-verification-stats')
  async getIdVerificationStats() {
    return this.adminService.getIdVerificationStats();
  }
}
