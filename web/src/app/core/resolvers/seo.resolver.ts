import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { Observable, of, tap, catchError } from 'rxjs';
import { SeoApiService } from '../services/seo-api.service';
import { MetaService } from '../services/meta.service';
import { StructuredDataService } from '../services/structured-data.service';
import { extractIdFromSlug } from '../utils/slug';
import { SEO_BASE_URL } from '../constants/seo';
import {
  ListingSeoResponse,
  SellerSeoResponse,
  HomeSeoResponse,
  SearchSeoResponse,
  PageSeoResponse,
  ShortSeoResponse,
} from '../models/seo.models';

/**
 * Route resolver that fetches listing SEO data, sets meta tags and
 * structured data (Product + Breadcrumb JSON-LD) before the component renders.
 */
export const listingSeoResolver: ResolveFn<ListingSeoResponse | null> = (
  route: ActivatedRouteSnapshot,
): Observable<ListingSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);
  const structuredData = inject(StructuredDataService);

  const id = extractIdFromSlug(route.paramMap.get('id') ?? '');

  return seoApi.getListingSeo(id).pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        canonicalUrl: data.canonicalUrl,
        ogType: 'product',
        twitterCard: 'summary_large_image',
      });

      if (data.price) {
        meta.setProductPriceTags(data.price, data.currency);
      } else {
        meta.removeProductPriceTags();
      }

      meta.setHreflangTags(data.canonicalUrl);

      structuredData.setProductData(data.productJsonLd);
      structuredData.setBreadcrumbData(data.categoryBreadcrumb);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};

/**
 * Route resolver that fetches seller SEO data, sets meta tags and
 * structured data (Person/Organization JSON-LD) before the component renders.
 */
export const sellerSeoResolver: ResolveFn<SellerSeoResponse | null> = (
  route: ActivatedRouteSnapshot,
): Observable<SellerSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);
  const structuredData = inject(StructuredDataService);

  const id = extractIdFromSlug(route.paramMap.get('id') ?? '');

  return seoApi.getSellerSeo(id).pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        imageUrl: data.avatarUrl,
        canonicalUrl: data.canonicalUrl,
        ogType: 'profile',
      });

      meta.setHreflangTags(data.canonicalUrl);

      structuredData.setSellerData(data.personJsonLd);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};

/**
 * Route resolver that fetches home page SEO data, sets meta tags and
 * structured data (WebSite JSON-LD with SearchAction) before the component renders.
 */
export const homeSeoResolver: ResolveFn<
  HomeSeoResponse | null
> = (): Observable<HomeSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);
  const structuredData = inject(StructuredDataService);

  return seoApi.getHomeSeo().pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        canonicalUrl: data.canonicalUrl,
        ogType: 'website',
      });

      structuredData.setWebsiteData(data.websiteJsonLd);
      structuredData.setOrganizationData(data.organizationJsonLd);
      meta.setHreflangTags(data.canonicalUrl);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};

/**
 * Route resolver that fetches search page SEO data and sets meta tags
 * before the component renders.
 */
export const searchSeoResolver: ResolveFn<SearchSeoResponse | null> = (
  route: ActivatedRouteSnapshot,
): Observable<SearchSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);

  const query = route.queryParamMap.get('q') ?? undefined;
  const category = route.queryParamMap.get('category') ?? undefined;

  return seoApi.getSearchSeo(query, category).pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        canonicalUrl: data.canonicalUrl,
        ogType: 'website',
      });

      meta.setHreflangTags(data.canonicalUrl);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};

/**
 * Route resolver that fetches static page SEO data, sets meta tags and
 * optionally injects FAQ JSON-LD before the component renders.
 */
export const pageSeoResolver: ResolveFn<PageSeoResponse | null> = (
  route: ActivatedRouteSnapshot,
): Observable<PageSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);
  const structuredData = inject(StructuredDataService);

  const slug = route.paramMap.get('slug') ?? route.url[route.url.length - 1]?.path ?? '';

  return seoApi.getPageSeo(slug).pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        canonicalUrl: data.canonicalUrl,
        ogType: data.ogType ?? 'website',
      });

      if (data.faqJsonLd) {
        structuredData.setFaqData(data.faqJsonLd);
      }

      meta.setHreflangTags(data.canonicalUrl);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};

/**
 * Route resolver for a single short video, keyed off the `?id=` query param the
 * shorts feed uses to open a specific short. Sets meta + VideoObject JSON-LD +
 * og:video / Twitter player tags. When no `id` is present (the plain feed), it
 * leaves the feed's own generic meta alone.
 */
export const shortSeoResolver: ResolveFn<ShortSeoResponse | null> = (
  route: ActivatedRouteSnapshot,
): Observable<ShortSeoResponse | null> => {
  const seoApi = inject(SeoApiService);
  const meta = inject(MetaService);
  const structuredData = inject(StructuredDataService);

  const id = route.queryParamMap.get('id');
  if (!id) {
    // Feed view (no specific short) — use the shorts collection defaults.
    meta.setPageMeta({
      title: 'Short Videos - Product Showcases | marketplace.pk',
      description:
        'Watch short product videos from sellers. Discover products through quick video showcases.',
      canonicalUrl: `${SEO_BASE_URL}/shorts`,
      ogType: 'website',
    });
    return of(null);
  }

  return seoApi.getShortSeo(id).pipe(
    tap((data) => {
      if (!data) {
        meta.setFallbackMeta();
        return;
      }

      meta.setPageMeta({
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        canonicalUrl: data.canonicalUrl,
        ogType: 'video.other',
        twitterCard: 'summary_large_image',
      });

      meta.setVideoTags({
        videoUrl: data.videoUrl,
        playerUrl: data.embedUrl,
        imageUrl: data.imageUrl,
      });

      meta.setHreflangTags(data.canonicalUrl);

      structuredData.setVideoData(data.videoJsonLd);
      structuredData.setBreadcrumbData(data.categoryBreadcrumb);
    }),
    catchError(() => {
      meta.setFallbackMeta();
      return of(null);
    }),
  );
};
