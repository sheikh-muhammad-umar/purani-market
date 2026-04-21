import {
  Controller,
  Get,
  Query,
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

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async search(@Query() query: SearchQueryDto): Promise<SearchResult> {
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
