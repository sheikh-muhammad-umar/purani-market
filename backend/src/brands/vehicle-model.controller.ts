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
import { VehicleModelService } from './vehicle-model.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { UserRole } from '../users/schemas/user.schema.js';
import {
  CreateVehicleModelDto,
  UpdateVehicleModelDto,
} from './dto/vehicle-model.dto.js';

@Controller('api/vehicle-models')
export class VehicleModelController {
  constructor(
    private readonly vehicleModelService: VehicleModelService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async getModels(
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('all') all?: string,
  ) {
    if (brandId) {
      return this.vehicleModelService.findByBrand(brandId, all !== 'true');
    }
    if (categoryId) {
      return this.vehicleModelService.findByCategory(
        categoryId,
        all !== 'true',
      );
    }
    return [];
  }

  @Get(':id')
  async getModel(@Param('id') id: string) {
    return this.vehicleModelService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createModel(
    @Body() dto: CreateVehicleModelDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const model = await this.vehicleModelService.create(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'vehicle_model', name: dto.name, brandId: dto.brandId },
      req,
    );
    return model;
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async bulkCreateModels(
    @Body() dtos: CreateVehicleModelDto[],
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const models = await this.vehicleModelService.bulkCreate(dtos);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'vehicle_model_bulk', count: models.length },
      req,
    );
    return models;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateModel(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleModelDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const model = await this.vehicleModelService.update(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_UPDATE,
      { type: 'vehicle_model', id, changes: Object.keys(dto).join(', ') },
      req,
    );
    return model;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteModel(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.vehicleModelService.delete(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_DELETE,
      { type: 'vehicle_model', id },
      req,
    );
    return { deleted: true };
  }
}
