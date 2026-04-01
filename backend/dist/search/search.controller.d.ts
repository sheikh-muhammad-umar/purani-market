import { SearchService, SearchResult, SuggestionResult } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SuggestionQueryDto } from './dto/suggestion-query.dto.js';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    search(query: SearchQueryDto): Promise<SearchResult>;
    suggestions(query: SuggestionQueryDto): Promise<SuggestionResult>;
}
