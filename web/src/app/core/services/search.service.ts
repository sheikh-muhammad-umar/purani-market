import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';
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
}
