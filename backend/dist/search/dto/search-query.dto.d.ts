export declare enum SearchSortOption {
    RELEVANCE = "relevance",
    PRICE_ASC = "price_asc",
    PRICE_DESC = "price_desc",
    NEWEST = "newest"
}
export declare class SearchQueryDto {
    q?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    condition?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    dateFrom?: string;
    sort?: SearchSortOption;
    page?: number;
    limit?: number;
    filters?: Record<string, any>;
}
