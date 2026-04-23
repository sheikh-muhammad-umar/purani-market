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
import { LocationService } from './location.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { GeocodeQueryDto } from './dto/geocode-query.dto.js';
import { CreateProvinceDto } from './dto/create-province.dto.js';
import { CreateCityDto } from './dto/create-city.dto.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';

@Controller('api/location')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
    private readonly tracker: AdminTrackerService,
  ) {}

  // ── Public read endpoints ─────────────────────────────────────────

  @Get('provinces')
  async getProvinces() {
    return this.locationService.getProvinces();
  }

  @Get('provinces/:provinceId/cities')
  async getCities(@Param('provinceId') provinceId: string) {
    return this.locationService.getCitiesByProvince(provinceId);
  }

  @Get('cities/:cityId/areas')
  async getAreas(@Param('cityId') cityId: string) {
    return this.locationService.getAreasByCity(cityId);
  }

  @Get('nearby')
  async getNearbyListings(
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.locationService.findNearby(
      { provinceId, cityId, areaId },
      limit ? parseInt(limit, 10) : undefined,
      page ? parseInt(page, 10) : undefined,
    );
  }

  @Get('geocode')
  @UseGuards(JwtAuthGuard)
  async geocodeLocation(@Query() query: GeocodeQueryDto) {
    return this.locationService.geocode(query.query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    return this.locationService.getLocationStats();
  }

  // ── Admin CRUD: Provinces ─────────────────────────────────────────

  @Post('provinces')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createProvince(
    @Body() dto: CreateProvinceDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const result = await this.locationService.createProvince(dto.name);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_CREATE,
      { type: 'province', name: dto.name },
      req,
    );
    return result;
  }

  @Patch('provinces/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateProvince(
    @Param('id') id: string,
    @Body() dto: CreateProvinceDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldProvince = await this.locationService.findProvinceById(id);
    const result = await this.locationService.updateProvince(id, dto.name);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_UPDATE,
      {
        type: 'province',
        id,
        previousName: oldProvince.name,
        newName: dto.name,
      },
      req,
    );
    return result;
  }

  @Delete('provinces/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteProvince(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldProvince = await this.locationService.findProvinceById(id);
    await this.locationService.deleteProvince(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_DELETE,
      { type: 'province', id, name: oldProvince.name },
      req,
    );
    return { deleted: true };
  }

  // ── Admin CRUD: Cities ────────────────────────────────────────────

  @Post('cities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCity(
    @Body() dto: CreateCityDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const result = await this.locationService.createCity(
      dto.name,
      dto.provinceId,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_CREATE,
      { type: 'city', name: dto.name, provinceId: dto.provinceId },
      req,
    );
    return result;
  }

  @Patch('cities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCity(
    @Param('id') id: string,
    @Body() dto: CreateProvinceDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldCity = await this.locationService.findCityById(id);
    const result = await this.locationService.updateCity(id, dto.name);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_UPDATE,
      { type: 'city', id, previousName: oldCity.name, newName: dto.name },
      req,
    );
    return result;
  }

  @Delete('cities/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCity(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldCity = await this.locationService.findCityById(id);
    await this.locationService.deleteCity(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_DELETE,
      { type: 'city', id, name: oldCity.name },
      req,
    );
    return { deleted: true };
  }

  // ── Admin CRUD: Areas ─────────────────────────────────────────────

  @Post('areas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createArea(
    @Body() dto: CreateAreaDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const result = await this.locationService.createArea(
      dto.name,
      dto.cityId,
      dto.subareas,
      dto.blockPhases,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_CREATE,
      { type: 'area', name: dto.name, cityId: dto.cityId },
      req,
    );
    return result;
  }

  @Patch('areas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateArea(
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldArea = await this.locationService.findAreaById(id);
    const snapshot: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      snapshot[key] = { from: (oldArea as any)[key], to: (dto as any)[key] };
    }
    const result = await this.locationService.updateArea(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_UPDATE,
      { type: 'area', id, name: oldArea.name, changes: snapshot },
      req,
    );
    return result;
  }

  @Delete('areas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteArea(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldArea = await this.locationService.findAreaById(id);
    await this.locationService.deleteArea(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_LOCATION_DELETE,
      { type: 'area', id, name: oldArea.name },
      req,
    );
    return { deleted: true };
  }
}
