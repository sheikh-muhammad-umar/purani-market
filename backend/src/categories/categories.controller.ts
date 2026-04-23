import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateAttributesDto } from './dto/update-attributes.dto.js';
import { UpdateFeaturesDto } from './dto/update-features.dto.js';

@Controller('api/categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async getCategoryTree() {
    return this.categoriesService.getCategoryTree();
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Get(':id/inherited-attributes')
  async getInheritedAttributes(@Param('id') id: string) {
    return {
      attributes: await this.categoriesService.getInheritedAttributes(id),
      features: await this.categoriesService.getInheritedFeatures(id),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const cat = await this.categoriesService.create(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_CREATE,
      { categoryId: cat._id?.toString(), name: dto.name },
      req,
    );
    return cat;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldCat = await this.categoriesService.findById(id);
    const snapshot: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      snapshot[key] = { from: (oldCat as any)[key], to: (dto as any)[key] };
    }
    const cat = await this.categoriesService.update(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_UPDATE,
      { categoryId: id, name: oldCat.name, changes: snapshot },
      req,
    );
    return cat;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const oldCat = await this.categoriesService.findById(id);
    await this.categoriesService.delete(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_DELETE,
      { categoryId: id, name: oldCat.name },
      req,
    );
  }

  @Patch(':id/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateAttributes(
    @Param('id') id: string,
    @Body() dto: UpdateAttributesDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const result = await this.categoriesService.updateAttributes(
      id,
      dto.attributes as any,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_ATTRIBUTES_UPDATE,
      { categoryId: id, attributeCount: dto.attributes?.length },
      req,
    );
    return result;
  }

  @Patch(':id/features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateFeatures(
    @Param('id') id: string,
    @Body() dto: UpdateFeaturesDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const result = await this.categoriesService.updateFeatures(
      id,
      dto.features,
    );
    this.tracker.track(
      adminId,
      UserAction.ADMIN_CATEGORY_FEATURES_UPDATE,
      { categoryId: id, featureCount: dto.features?.length },
      req,
    );
    return result;
  }
}
