import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, timeout, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';
import { SEO_SSR_TIMEOUT_MS } from '../constants/seo';
import {
  ListingSeoResponse,
  SellerSeoResponse,
  HomeSeoResponse,
  SearchSeoResponse,
  PageSeoResponse,
} from '../models/seo.models';

@Injectable({ providedIn: 'root' })
export class SeoApiService {
  private readonly api = inject(ApiService);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  getListingSeo(id: string): Observable<ListingSeoResponse | null> {
    return this.withSsrTimeout(this.api.get<ListingSeoResponse>(API.SEO_LISTING(id)));
  }

  getSellerSeo(id: string): Observable<SellerSeoResponse | null> {
    return this.withSsrTimeout(this.api.get<SellerSeoResponse>(API.SEO_SELLER(id)));
  }

  getHomeSeo(): Observable<HomeSeoResponse | null> {
    return this.withSsrTimeout(this.api.get<HomeSeoResponse>(API.SEO_HOME));
  }

  getSearchSeo(query?: string, category?: string): Observable<SearchSeoResponse | null> {
    const params: Record<string, string> = {};
    if (query) params['q'] = query;
    if (category) params['category'] = category;
    return this.withSsrTimeout(
      this.api.get<SearchSeoResponse>(
        API.SEO_SEARCH,
        Object.keys(params).length ? params : undefined,
      ),
    );
  }

  getPageSeo(slug: string): Observable<PageSeoResponse | null> {
    return this.withSsrTimeout(this.api.get<PageSeoResponse>(API.SEO_PAGE(slug)));
  }

  /**
   * During SSR, apply a 2-second timeout so a slow SEO API call
   * doesn't block the entire page render. On timeout or error,
   * return `null` so the caller can fall back to default meta.
   */
  private withSsrTimeout<T>(source$: Observable<T>): Observable<T | null> {
    if (!this.isServer) {
      return source$;
    }
    return source$.pipe(
      timeout(SEO_SSR_TIMEOUT_MS),
      catchError(() => of(null)),
    );
  }
}
