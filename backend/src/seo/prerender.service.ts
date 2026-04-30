import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  SEO_STATIC_PAGES,
  SEO_PRERENDER_HOME_TTL,
  SEO_PRERENDER_STATIC_TTL,
  SEO_PRERENDER_FETCH_TIMEOUT_MS,
  SEO_PRERENDER_STALE_THRESHOLD_RATIO,
} from '../common/constants/index.js';

/**
 * PrerenderService triggers periodic HTTP requests to prerendered routes,
 * refreshing the cached HTML served by the Angular SSR engine.
 *
 * - Home page: refreshed every 1 hour
 * - Static pages: refreshed every 24 hours
 *
 * Implements stale-while-revalidate: the previous prerendered HTML remains
 * available in Redis while the background refresh is in progress. Once the
 * new HTML is fetched, it replaces the stale entry.
 */
@Injectable()
export class PrerenderService {
  private readonly logger = new Logger(PrerenderService.name);

  /** Base URL of the Angular SSR server (e.g. http://localhost:4200) */
  private readonly baseUrl: string;

  /** All static page paths that are prerendered */
  static readonly STATIC_PAGES = SEO_STATIC_PAGES.map(
    (page) => `/pages/${page}`,
  );

  /** Home page path */
  static readonly HOME_PAGE = '/';

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    const corsOrigins =
      this.configService.get<string>('cors.allowedOrigins') ||
      'http://localhost:4200';
    // Use the first allowed origin as the SSR server base URL
    this.baseUrl = corsOrigins.split(',')[0].trim();
  }

  /**
   * Refresh the home page prerender cache every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshHomePage(): Promise<void> {
    this.logger.log('Starting home page prerender refresh');
    await this.refreshRoute(PrerenderService.HOME_PAGE, SEO_PRERENDER_HOME_TTL);
  }

  /**
   * Refresh all static pages prerender cache every 24 hours.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshStaticPages(): Promise<void> {
    this.logger.log(
      `Starting static pages prerender refresh (${PrerenderService.STATIC_PAGES.length} pages)`,
    );

    const results = await Promise.allSettled(
      PrerenderService.STATIC_PAGES.map((route) =>
        this.refreshRoute(route, SEO_PRERENDER_STATIC_TTL),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Static pages prerender refresh complete: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  /**
   * Fetch a route from the SSR server and cache the rendered HTML in Redis.
   * Implements stale-while-revalidate: the old cached HTML remains available
   * while the new HTML is being fetched. On success, the cache is updated
   * with the fresh HTML and a new TTL.
   */
  async refreshRoute(route: string, ttlSeconds: number): Promise<void> {
    const cacheKey = `prerender:${route}`;
    const url = `${this.baseUrl}${route}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        SEO_PRERENDER_FETCH_TIMEOUT_MS,
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MarketplacePrerenderBot/1.0',
          Accept: 'text/html',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(
          `Prerender refresh failed for ${route}: HTTP ${response.status}`,
        );
        return;
      }

      const html = await response.text();

      // Store the fresh HTML in Redis with TTL
      await this.redis.setex(cacheKey, ttlSeconds, html);

      this.logger.debug(
        `Prerender cache updated for ${route} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error) {
      this.logger.error(
        `Prerender refresh error for ${route}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get cached prerendered HTML for a route.
   * Returns null if no cached version exists or the cache has expired.
   */
  async getCachedHtml(route: string): Promise<string | null> {
    const cacheKey = `prerender:${route}`;
    try {
      return await this.redis.get(cacheKey);
    } catch (error) {
      this.logger.error(
        `Failed to read prerender cache for ${route}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Check if a cached prerender is stale (TTL expired or near expiry).
   * If stale, triggers a background refresh while returning the stale HTML.
   */
  async getWithStaleWhileRevalidate(route: string): Promise<string | null> {
    const cacheKey = `prerender:${route}`;

    try {
      const [html, ttl] = await Promise.all([
        this.redis.get(cacheKey),
        this.redis.ttl(cacheKey),
      ]);

      if (!html) {
        return null;
      }

      // Determine the original TTL based on route type
      const isHomePage = route === PrerenderService.HOME_PAGE;
      const originalTtl = isHomePage
        ? SEO_PRERENDER_HOME_TTL
        : SEO_PRERENDER_STATIC_TTL;

      // If TTL is less than 10% of original, trigger background refresh
      const staleThreshold = Math.floor(
        originalTtl * SEO_PRERENDER_STALE_THRESHOLD_RATIO,
      );
      if (ttl >= 0 && ttl < staleThreshold) {
        this.logger.debug(
          `Stale prerender detected for ${route} (TTL: ${ttl}s), triggering background refresh`,
        );
        // Fire-and-forget background refresh
        this.refreshRoute(route, originalTtl).catch((err) =>
          this.logger.error(`Background refresh failed for ${route}: ${err}`),
        );
      }

      return html;
    } catch (error) {
      this.logger.error(
        `Stale-while-revalidate error for ${route}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
