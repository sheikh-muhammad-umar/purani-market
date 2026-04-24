import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto.js';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('api/attribute-definitions')
export class AttributeDefinitionsController {
  constructor(private readonly service: AttributeDefinitionsService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get('search')
  async search(@Query('q') query: string) {
    return this.service.search(query || '');
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateAttributeDefinitionDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDefinitionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
