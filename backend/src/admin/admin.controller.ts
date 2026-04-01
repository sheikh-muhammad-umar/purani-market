import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../common/guards/index.js';
import { Roles } from '../common/decorators/index.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { AdminService } from './admin.service.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateAdLimitDto } from './dto/update-ad-limit.dto.js';
import { RejectListingDto } from './dto/reject-listing.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    const result = await this.adminService.listUsers(query);

    // Enrich each user with activity summary
    const enrichedData = await Promise.all(
      result.data.map(async (user: any) => {
        const activity = await this.adminService.getUserActivitySummary(
          user._id.toString(),
        );
        return { ...user, activitySummary: activity };
      }),
    );

    return { ...result, data: enrichedData };
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const user = await this.adminService.updateUserStatus(id, dto.status);
    return { message: `User status updated to ${dto.status}`, userId: user._id };
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = await this.adminService.updateUserRole(id, dto.role);
    return { message: `User role updated to ${dto.role}`, userId: user._id };
  }

  @Patch('users/:id/ad-limit')
  async updateAdLimit(
    @Param('id') id: string,
    @Body() dto: UpdateAdLimitDto,
  ) {
    const user = await this.adminService.updateAdLimit(id, dto.adLimit);
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
  async approveListing(@Param('id') id: string) {
    const listing = await this.adminService.approveListing(id);
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
  ) {
    const listing = await this.adminService.rejectListing(
      id,
      dto.rejectionReason,
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

  @Get('analytics/export')
  async exportAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const now = new Date();
    const from = dateFrom || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const to = dateTo || now.toISOString().split('T')[0];
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
}
