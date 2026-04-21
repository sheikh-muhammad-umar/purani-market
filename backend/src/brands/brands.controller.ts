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
import { BrandsService } from './brands.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto.js';

@Controller('api/brands')
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly tracker: AdminTrackerService,
  ) {}

  // Public: get brands for a category
  @Get()
  async getBrands(
    @Query('categoryId') categoryId?: string,
    @Query('all') all?: string,
  ) {
    if (categoryId) {
      return this.brandsService.findByCategory(categoryId, all !== 'true');
    }
    return this.brandsService.findAll(all !== 'true');
  }

  @Get(':id')
  async getBrand(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  // Admin CRUD
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createBrand(
    @Body() dto: CreateBrandDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const brand = await this.brandsService.create(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { type: 'brand', name: dto.name, categoryId: dto.categoryId },
      req,
    );
    return brand;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateBrand(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const brand = await this.brandsService.update(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_UPDATE,
      { type: 'brand', id, changes: Object.keys(dto).join(', ') },
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
    await this.brandsService.delete(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_DELETE,
      { type: 'brand', id },
      req,
    );
    return { deleted: true };
  }
}
