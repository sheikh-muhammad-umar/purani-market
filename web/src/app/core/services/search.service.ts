import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Listing } from '../models';

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

export interface SearchResponse {
  data: Listing[];
  total: number;
  page: number;
  limit: number;
  featuredAds?: Listing[];
  suggestions?: string[];
  relatedCategories?: { _id: string; name: string; slug: string }[];
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
    return this.api.get<SearchResponse>('/search', cleanParams);
  }

  getSuggestions(query: string): Observable<SearchSuggestion[]> {
    return this.api.get<SearchSuggestion[]>('/search/suggestions', { q: query });
  }
}
