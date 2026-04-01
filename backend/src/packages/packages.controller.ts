import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';

@Controller('api/packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

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
  async createPackage(@Body() dto: CreatePackageDto) {
    return this.packagesService.createPackage(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packagesService.updatePackage(id, dto);
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
