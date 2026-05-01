import {
  Controller,
  Get,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  SearchService,
  SearchResult,
  SuggestionResult,
} from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SuggestionQueryDto } from './dto/suggestion-query.dto.js';

// Known query param keys from SearchQueryDto
const KNOWN_KEYS = new Set([
  'q',
  'category',
  'priceMin',
  'priceMax',
  'condition',
  'provinceId',
  'cityId',
  'areaId',
  'province',
  'city',
  'area',
  'blockPhase',
  'brandId',
  'modelName',
  'lat',
  'lng',
  'radius',
  'dateFrom',
  'sort',
  'page',
  'limit',
  'filters',
  'verifiedSeller',
]);

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async search(
    @Query() query: SearchQueryDto,
    @Req() req: any,
  ): Promise<SearchResult> {
    // Collect unknown query params as category attribute filters
    const rawQuery = req.query || {};
    const attrFilters: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (!KNOWN_KEYS.has(key) && value) {
        attrFilters[key] = value;
      }
    }
    if (Object.keys(attrFilters).length > 0) {
      query.filters = { ...(query.filters || {}), ...attrFilters };
    }
    return this.searchService.search(query);
  }

  @Get('suggestions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async suggestions(
    @Query() query: SuggestionQueryDto,
  ): Promise<SuggestionResult> {
    return this.searchService.suggestions(query);
  }
}
