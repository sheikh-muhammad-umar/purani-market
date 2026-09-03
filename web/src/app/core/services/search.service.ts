import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';
import { ShortVideo } from './shorts.service';
import { API } from '../constants/api-endpoints';

export interface SearchParams {
  q?: string;
  category?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  location?: string;
  radius?: number;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

/** One option of a facet, with how many results choosing it would yield. */
export interface FacetBucket {
  value: string;
  count: number;
}

/**
 * Per-option counts (or numeric bounds) for a filterable category attribute.
 * Each facet is computed with the other active filters applied but its own
 * excluded, so the counts answer "what would I get if I switched this option".
 */
export interface SearchFacet {
  key: string;
  type: string;
  buckets?: FacetBucket[];
  min?: number | null;
  max?: number | null;
}

export interface SearchResponse {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  featuredAds?: Listing[];
  suggestions?: string[];
  relatedCategories?: { _id: string; name: string; slug: string }[];
  facets?: SearchFacet[];
}

export interface SearchSuggestion {
  term: string;
  type: 'recent' | 'trending' | 'ai';
}

/**
 * Shorts search results. Items are a partial {@link ShortVideo} — the search
 * index stores only what's needed to render a short-card, so fields like
 * `video.duration` and `currency` may be absent (the card tolerates that).
 */
export interface ShortsSearchResponse {
  items: ShortVideo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private readonly api: ApiService) {}

  search(params: SearchParams): Observable<SearchResponse> {
    const cleanParams: Record<string, string | number | boolean> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value;
      }
    });
    return this.api.get<SearchResponse>(API.SEARCH, cleanParams);
  }

  getSuggestions(query: string): Observable<SearchSuggestion[]> {
    return this.api.get<SearchSuggestion[]>(API.SEARCH_SUGGESTIONS, { q: query });
  }

  searchShorts(params: SearchParams): Observable<ShortsSearchResponse> {
    const cleanParams: Record<string, string | number | boolean> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = value;
      }
    });
    return this.api.get<ShortsSearchResponse>(API.SEARCH_SHORTS, cleanParams);
  }
}
