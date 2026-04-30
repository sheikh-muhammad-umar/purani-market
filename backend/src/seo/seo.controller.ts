import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SeoService } from './seo.service.js';
import { ListingSeoDto } from './dto/listing-seo.dto.js';
import { SellerSeoDto } from './dto/seller-seo.dto.js';
import { HomeSeoDto } from './dto/home-seo.dto.js';
import { SearchSeoDto } from './dto/search-seo.dto.js';
import { PageSeoDto } from './dto/page-seo.dto.js';

@Controller('api/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('search')
  async getSearchSeo(
    @Query('q') query?: string,
    @Query('category') category?: string,
  ): Promise<SearchSeoDto> {
    return this.seoService.getSearchSeo(query, category);
  }

  @Get('page/:slug')
  async getPageSeo(@Param('slug') slug: string): Promise<PageSeoDto> {
    return this.seoService.getPageSeo(slug);
  }

  @Get('listing/:id')
  async getListingSeo(@Param('id') id: string): Promise<ListingSeoDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid listing ID');
    }
    return this.seoService.getListingSeo(id);
  }

  @Get('seller/:id')
  async getSellerSeo(@Param('id') id: string): Promise<SellerSeoDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid seller ID');
    }
    return this.seoService.getSellerSeo(id);
  }

  @Get('home')
  async getHomeSeo(): Promise<HomeSeoDto> {
    return this.seoService.getHomeSeo();
  }
}
