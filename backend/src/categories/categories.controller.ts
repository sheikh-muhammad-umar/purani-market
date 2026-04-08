import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateAttributesDto } from './dto/update-attributes.dto.js';
import { UpdateFeaturesDto } from './dto/update-features.dto.js';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

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
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.delete(id);
  }

  @Patch(':id/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateAttributes(@Param('id') id: string, @Body() dto: UpdateAttributesDto) {
    return this.categoriesService.updateAttributes(id, dto.attributes as any);
  }

  @Patch(':id/features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateFeatures(@Param('id') id: string, @Body() dto: UpdateFeaturesDto) {
    return this.categoriesService.updateFeatures(id, dto.features);
  }
}
