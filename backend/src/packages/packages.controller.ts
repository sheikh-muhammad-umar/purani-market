import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
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
import { PACKAGE_ROUTES } from '../payments/constants.js';
import { ERROR } from '../common/constants/error-messages.js';

@Controller(PACKAGE_ROUTES.BASE)
export class PackagesController {
  constructor(
    private readonly packagesService: PackagesService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async findAll() {
    return this.packagesService.findAll();
  }

  @Get(PACKAGE_ROUTES.AVAILABLE)
  @UseGuards(JwtAuthGuard)
  async getAvailablePackages(
    @CurrentUser('sub') sellerId: string,
    @Query('categoryId') categoryId: string,
  ) {
    if (!categoryId || !Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException(ERROR.INVALID_CATEGORY_ID_PARAM);
    }
    return this.packagesService.getAvailablePackages(sellerId, categoryId);
  }

  @Get(PACKAGE_ROUTES.MY_PURCHASES)
  @UseGuards(JwtAuthGuard)
  async getMyPurchases(
    @CurrentUser('sub') sellerId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException(ERROR.INVALID_CATEGORY_ID_FILTER);
    }
    return this.packagesService.getMyPurchases(sellerId, categoryId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.packagesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPackage(
    @Body() dto: CreatePackageDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const pkg = await this.packagesService.createPackage(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_PACKAGE_CREATE,
      { packageName: dto.name, type: dto.type },
      req,
    );
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
    const oldPkg = await this.packagesService.findById(id);
    const snapshot: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      snapshot[key] = { from: (oldPkg as any)[key], to: (dto as any)[key] };
    }
    const pkg = await this.packagesService.updatePackage(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_PACKAGE_UPDATE,
      { packageId: id, packageName: oldPkg.name, changes: snapshot },
      req,
    );
    return pkg;
  }

  @Post(PACKAGE_ROUTES.PURCHASE)
  @UseGuards(JwtAuthGuard)
  async purchasePackages(
    @CurrentUser('sub') sellerId: string,
    @Body() dto: PurchasePackageDto,
  ) {
    return this.packagesService.purchasePackages(sellerId, dto);
  }

  @Post(PACKAGE_ROUTES.PAYMENT_CALLBACK)
  async paymentCallback(@Body() payload: Record<string, any>) {
    return this.packagesService.handlePaymentCallback(payload);
  }
}
