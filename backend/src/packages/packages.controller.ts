import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';

@Controller('api/packages')
export class PackagesController {
  constructor(
    private readonly packagesService: PackagesService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async findAll() {
    return this.packagesService.findAll();
  }

  @Get('my-purchases')
  @UseGuards(JwtAuthGuard)
  async getMyPurchases(@CurrentUser('sub') sellerId: string) {
    return this.packagesService.getMyPurchases(sellerId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.packagesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPackage(@Body() dto: CreatePackageDto, @CurrentUser('sub') adminId: string, @Req() req: any) {
    const pkg = await this.packagesService.createPackage(dto);
    this.tracker.track(adminId, UserAction.ADMIN_PACKAGE_CREATE, { packageName: dto.name, type: dto.type }, req);
    return pkg;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const pkg = await this.packagesService.updatePackage(id, dto);
    this.tracker.track(adminId, UserAction.ADMIN_PACKAGE_UPDATE, { packageId: id, changes: Object.keys(dto).join(', ') }, req);
    return pkg;
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchasePackages(
    @CurrentUser('sub') sellerId: string,
    @Body() dto: PurchasePackageDto,
  ) {
    return this.packagesService.purchasePackages(sellerId, dto);
  }

  @Post('payment-callback')
  async paymentCallback(@Body() payload: Record<string, any>) {
    return this.packagesService.handlePaymentCallback(payload);
  }
}
