import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VehicleVariantService } from './vehicle-variant.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { UserRole } from '../users/schemas/user.schema.js';
import {
  CreateVehicleVariantDto,
  UpdateVehicleVariantDto,
} from './dto/vehicle-variant.dto.js';

@Controller('api/vehicle-variants')
export class VehicleVariantController {
  constructor(
    private readonly vehicleVariantService: VehicleVariantService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async getVariants(
    @Query('modelId') modelId?: string,
    @Query('brandId') brandId?: string,
    @Query('all') all?: string,
  ) {
    if (modelId) {
      return this.vehicleVariantService.findByModel(modelId, all !== 'true');
    }
    if (brandId) {
      return this.vehicleVariantService.findByBrand(brandId, all !== 'true');
    }
    return [];
  }

  @Get(':id')
  async getVariant(@Param('id') id: string) {
    return this.vehicleVariantService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createVariant(
    @Body() dto: CreateVehicleVariantDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const variant = await this.vehicleVariantService.create(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'vehicle_variant', name: dto.name, modelId: dto.modelId },
      req,
    );
    return variant;
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async bulkCreateVariants(
    @Body() dtos: CreateVehicleVariantDto[],
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const variants = await this.vehicleVariantService.bulkCreate(dtos);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'vehicle_variant_bulk', count: variants.length },
      req,
    );
    return variants;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleVariantDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const variant = await this.vehicleVariantService.update(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_UPDATE,
      { type: 'vehicle_variant', id, changes: Object.keys(dto).join(', ') },
      req,
    );
    return variant;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteVariant(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.vehicleVariantService.delete(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_DELETE,
      { type: 'vehicle_variant', id },
      req,
    );
    return { deleted: true };
  }
}
