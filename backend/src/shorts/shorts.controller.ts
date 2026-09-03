import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShortsService } from './shorts.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { CreateShortDto } from './dto/create-short.dto.js';
import { UpdateShortDto } from './dto/update-short.dto.js';
import { CreateShortsPackageDto } from './dto/create-shorts-package.dto.js';
import { UpdateShortsPackageDto } from './dto/update-shorts-package.dto.js';
import { PurchaseShortsPackageDto } from './dto/purchase-shorts-package.dto.js';
import { RejectShortDto } from './dto/update-short-status.dto.js';
import { ListShortsQueryDto } from './dto/list-shorts-query.dto.js';

@Controller('api/shorts')
export class ShortsController {
  constructor(private readonly shortsService: ShortsService) {}

  // ═══════════════════════════════════════════════════════════
  // PUBLIC ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  /** Public feed of active shorts */
  @Get('feed')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('city') city?: string,
    @Query('seed') seed?: string,
    @Query('seen') seen?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const seenIds = seen ? seen.split(',').filter(Boolean) : [];

    const result = await this.shortsService.getPublicFeed(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      {
        search,
        categoryId,
        provinceId,
        cityId,
        areaId,
        city,
        seed,
        seen: seenIds,
      },
    );

    if (userId) {
      const likedIds = await this.shortsService.getUserLikedShortIds(
        userId,
        result.data.map((s) => s._id.toString()),
      );
      const likedSet = new Set(likedIds);
      result.data = result.data.map((s: any) => {
        const obj = s.toJSON ? s.toJSON() : s;
        return { ...obj, isLikedByMe: likedSet.has(obj._id.toString()) };
      });
    }

    return result;
  }

  /** Get shorts by seller (public) */
  @Get('seller/:sellerId')
  async getSellerShorts(
    @Param('sellerId') sellerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shortsService.getSellerShorts(
      sellerId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /** Get single short by ID */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getShortById(
    @Param('id') id: string,
    @Req() req: unknown,
    @CurrentUser('sub') userId?: string,
    @CurrentUser('role') role?: string,
  ) {
    const short = await this.shortsService.getShortById(id, { userId, role });
    // Fire-and-forget: a view is not worth delaying the response for, and a
    // failure to count one must not fail the request.
    void this.shortsService
      .registerView(id, { userId, req })
      .catch(() => undefined);
    const liked = userId
      ? await this.shortsService.isLikedByUser(id, userId)
      : false;
    return { ...short.toJSON(), isLikedByMe: liked };
  }

  // ═══════════════════════════════════════════════════════════
  // AUTHENTICATED USER ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  /** Upload a new short video */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('video'))
  async createShort(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateShortDto,
  ) {
    return this.shortsService.createShort(userId, file, dto);
  }

  /** Get my shorts */
  @Get('my/list')
  @UseGuards(JwtAuthGuard)
  async getMyShorts(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shortsService.getMyShorts(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /** Get my shorts stats */
  @Get('my/stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@CurrentUser('sub') userId: string) {
    return this.shortsService.getShortsStats(userId);
  }

  /** Delete my short */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteShort(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.shortsService.deleteShort(id, userId);
    return { message: 'Short deleted successfully' };
  }

  /** Update short details (goes back to pending review) */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateShort(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateShortDto,
  ) {
    return this.shortsService.updateShort(id, userId, dto);
  }

  /** Like/favorite a short */
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async likeShort(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.shortsService.likeShort(id, userId);
  }

  /** Unlike/unfavorite a short */
  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  async unlikeShort(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shortsService.unlikeShort(id, userId);
  }

  /** Record a share of a short (public — no auth required) */
  @Post(':id/share')
  @UseGuards(OptionalJwtAuthGuard)
  async shareShort(
    @Param('id') id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.shortsService.recordShare(id, userId);
  }

  /** Get my liked/favorite shorts */
  @Get('my/liked')
  @UseGuards(JwtAuthGuard)
  async getMyLikedShorts(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shortsService.getLikedShorts(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PACKAGES (PUBLIC + AUTH)
  // ═══════════════════════════════════════════════════════════

  /** Get available shorts packages */
  @Get('packages/available')
  async getAvailablePackages() {
    return this.shortsService.getPackages(true);
  }

  /** Purchase a shorts package */
  @Post('packages/purchase')
  @UseGuards(JwtAuthGuard)
  async purchasePackage(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseShortsPackageDto,
  ) {
    return this.shortsService.purchasePackage(userId, dto);
  }

  /** Get my purchases */
  @Get('packages/my-purchases')
  @UseGuards(JwtAuthGuard)
  async getMyPurchases(@CurrentUser('sub') userId: string) {
    return this.shortsService.getMyPurchases(userId);
  }

  /**
   * Credit the seller can spend on a short right now, including the shorts
   * allowance inside an all-in-one bundle. The upload screen needs this to send a
   * `purchaseId`; without it a paid package could never be used.
   */
  @Get('packages/usable')
  @UseGuards(JwtAuthGuard)
  async getUsablePackages(@CurrentUser('sub') userId: string) {
    return this.shortsService.getUsableShortsPackages(userId);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  /** Admin: List all shorts with filters */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminListShorts(@Query() query: ListShortsQueryDto) {
    return this.shortsService.adminListShorts(query);
  }

  /** Admin: Approve a short */
  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminApproveShort(@Param('id') id: string) {
    return this.shortsService.adminApproveShort(id);
  }

  /** Admin: Reject a short */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminRejectShort(@Param('id') id: string, @Body() dto: RejectShortDto) {
    return this.shortsService.adminRejectShort(id, dto.rejectionReason);
  }

  /** Admin: Delete a short */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminDeleteShort(@Param('id') id: string) {
    await this.shortsService.adminDeleteShort(id);
    return { message: 'Short deleted by admin' };
  }

  /** Admin: Create a shorts package */
  @Post('admin/packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPackage(@Body() dto: CreateShortsPackageDto) {
    return this.shortsService.createPackage(dto);
  }

  /** Admin: Update a shorts package */
  @Patch('admin/packages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdateShortsPackageDto,
  ) {
    return this.shortsService.updatePackage(id, dto);
  }

  /** Admin: Get all packages (including inactive) */
  @Get('admin/packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminGetPackages() {
    return this.shortsService.getPackages(false);
  }

  /** Admin: List shorts package purchases (pending by default) */
  @Get('admin/purchases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminListPurchases(@Query('status') status?: string) {
    return this.shortsService.adminListPurchases(status as any);
  }

  /** Admin: Confirm payment for a purchase */
  @Patch('admin/purchases/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async confirmPayment(@Param('id') id: string) {
    await this.shortsService.confirmPayment(id);
    return { message: 'Payment confirmed' };
  }

  /** Admin: Get shorts analytics */
  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.shortsService.getAnalytics(dateFrom, dateTo);
  }
}
