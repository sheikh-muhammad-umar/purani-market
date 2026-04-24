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
import { VehicleBrandService } from './vehicle-brand.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { UserRole } from '../users/schemas/user.schema.js';
import {
  CreateVehicleBrandDto,
  UpdateVehicleBrandDto,
} from './dto/vehicle-brand.dto.js';

@Controller('api/vehicle-brands')
export class VehicleBrandController {
  constructor(
    private readonly vehicleBrandService: VehicleBrandService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async getBrands(
    @Query('categoryId') categoryId?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('all') all?: string,
  ) {
    if (categoryId) {
      return this.vehicleBrandService.findByCategory(
        categoryId,
        all !== 'true',
      );
    }
    if (vehicleType) {
      return this.vehicleBrandService.findByVehicleType(
        vehicleType,
        all !== 'true',
      );
    }
    return this.vehicleBrandService.findAll(all !== 'true');
  }

  @Get('check-category/:categoryId')
  async checkCategory(@Param('categoryId') categoryId: string) {
    const count = await this.vehicleBrandService.countByCategory(categoryId);
    return { hasVehicleBrands: count > 0 };
  }

  @Get(':id')
  async getBrand(@Param('id') id: string) {
    return this.vehicleBrandService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createBrand(
    @Body() dto: CreateVehicleBrandDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const brand = await this.vehicleBrandService.create(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'vehicle_brand', name: dto.name, categoryId: dto.categoryId },
      req,
    );
    return brand;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleBrandDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const brand = await this.vehicleBrandService.update(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_UPDATE,
      { type: 'vehicle_brand', id, changes: Object.keys(dto).join(', ') },
      req,
    );
    return brand;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteBrand(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.vehicleBrandService.delete(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_DELETE,
      { type: 'vehicle_brand', id },
      req,
    );
    return { deleted: true };
  }
}
