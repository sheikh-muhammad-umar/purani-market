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
import { ShortSeoDto } from './dto/short-seo.dto.js';
import { ERROR } from '../common/constants/error-messages.js';
import {
  SEO_BASE_URL,
  SEO_SITE_NAME,
  SEO_OG_DEFAULT_IMAGE,
  SEO_ROUTE_PATTERNS,
} from '../common/constants/index.js';

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
      throw new BadRequestException(ERROR.INVALID_LISTING_ID);
    }
    return this.seoService.getListingSeo(id);
  }

  @Get('seller/:id')
  async getSellerSeo(@Param('id') id: string): Promise<SellerSeoDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(ERROR.INVALID_SELLER_ID);
    }
    return this.seoService.getSellerSeo(id);
  }

  @Get('home')
  async getHomeSeo(): Promise<HomeSeoDto> {
    return this.seoService.getHomeSeo();
  }

  /** SEO for the shorts feed (collection) page. */
  @Get('shorts')
  getShortsSeo(): Record<string, unknown> {
    const url = `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.SHORTS}`;
    return {
      title: `Short Videos - Product Showcases | ${SEO_SITE_NAME}`,
      description: `Watch short product videos from sellers. Discover products through quick video showcases on ${SEO_SITE_NAME}.`,
      canonicalUrl: url,
      ogType: 'website',
      ogImage: SEO_OG_DEFAULT_IMAGE,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Short Videos',
        description: 'Product showcase short videos from sellers',
        url,
      },
    };
  }

  /** SEO for a single short video (VideoObject rich result). */
  @Get('shorts/:id')
  async getShortSeo(@Param('id') id: string): Promise<ShortSeoDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(ERROR.INVALID_LISTING_ID);
    }
    return this.seoService.getShortSeo(id);
  }
}
