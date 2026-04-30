import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { SlugService } from './slug.service.js';
import { SitemapUrl } from './dto/sitemap-url.dto.js';
import {
  CACHE_KEY_SITEMAP,
  CACHE_KEY_SITEMAP_INDEX,
  CACHE_TTL_SITEMAP,
  SITEMAP_MAX_URLS,
  SEO_BASE_URL,
  SEO_STATIC_PAGES,
  SEO_ROUTE_PATTERNS,
} from '../common/constants/index.js';

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly slugService: SlugService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Build sitemap URLs for all active listings.
   * Each URL has priority 0.8 and lastmod from the listing's updatedAt.
   */
  async buildListingUrls(): Promise<SitemapUrl[]> {
    const listings = await this.listingModel
      .find({ status: ListingStatus.ACTIVE })
      .select('_id title updatedAt')
      .lean()
      .exec();

    return listings.map((listing) => {
      const url = new SitemapUrl();
      url.loc = `${SEO_BASE_URL}${this.slugService.generateListingUrl(listing)}`;
      url.lastmod = listing.updatedAt.toISOString();
      url.priority = 0.8;
      return url;
    });
  }

  /**
   * Build sitemap URLs for all active categories.
   * Each URL points to /search?category={slug} with priority 0.7.
   */
  async buildCategoryUrls(): Promise<SitemapUrl[]> {
    const categories = await this.categoryModel
      .find({ isActive: true })
      .select('_id slug updatedAt')
      .lean()
      .exec();

    return categories.map((category) => {
      const url = new SitemapUrl();
      url.loc = `${SEO_BASE_URL}${SEO_ROUTE_PATTERNS.SEARCH}?category=${encodeURIComponent(category.slug)}`;
      url.priority = 0.7;
      return url;
    });
  }

  /**
   * Build sitemap URLs for sellers who have at least one active listing.
   * Each URL has priority 0.5.
   */
  async buildSellerUrls(): Promise<SitemapUrl[]> {
    const sellerIds = await this.listingModel
      .distinct('sellerId', { status: ListingStatus.ACTIVE })
      .exec();

    return sellerIds.map((sellerId) => {
      const url = new SitemapUrl();
      url.loc = `${SEO_BASE_URL}${this.slugService.generateSellerUrl(sellerId.toString())}`;
      url.priority = 0.5;
      return url;
    });
  }

  /**
   * Build sitemap URLs for static pages.
   * Home page has priority 1.0, all other static pages have priority 0.3.
   */
  buildStaticUrls(): SitemapUrl[] {
    const urls: SitemapUrl[] = [];

    // Home page
    const home = new SitemapUrl();
    home.loc = `${SEO_BASE_URL}/`;
    home.priority = 1.0;
    urls.push(home);

    // Static pages
    for (const page of SEO_STATIC_PAGES) {
      const staticUrl = new SitemapUrl();
      staticUrl.loc = `${SEO_BASE_URL}/pages/${page}`;
      staticUrl.priority = 0.3;
      urls.push(staticUrl);
    }

    return urls;
  }

  /**
   * Generate XML for a single sitemap containing the given URLs.
   * Conforms to the sitemaps.org protocol.
   */
  generateSitemapXml(urls: SitemapUrl[]): string {
    const urlEntries = urls
      .map((url) => {
        let entry = '  <url>\n';
        entry += `    <loc>${this.escapeXml(url.loc)}</loc>\n`;
        if (url.lastmod) {
          entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
        }
        if (url.changefreq) {
          entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
        }
        entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
        entry += '  </url>';
        return entry;
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urlEntries,
      '</urlset>',
    ].join('\n');
  }

  /**
   * Generate a sitemap index XML referencing multiple sitemap part URLs.
   */
  generateSitemapIndex(sitemapUrls: string[]): string {
    const entries = sitemapUrls
      .map((url) => {
        return [
          '  <sitemap>',
          `    <loc>${this.escapeXml(url)}</loc>`,
          '  </sitemap>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      entries,
      '</sitemapindex>',
    ].join('\n');
  }

  /**
   * Generate the full sitemap. If total URLs exceed SITEMAP_MAX_URLS (50,000),
   * splits into multiple sitemap files and creates a sitemap index.
   *
   * Results are cached in Redis with a TTL of 6 hours.
   */
  async generateSitemap(): Promise<string> {
    try {
      const [listingUrls, categoryUrls, sellerUrls] = await Promise.all([
        this.buildListingUrls(),
        this.buildCategoryUrls(),
        this.buildSellerUrls(),
      ]);
      const staticUrls = this.buildStaticUrls();

      const allUrls = [
        ...staticUrls,
        ...categoryUrls,
        ...sellerUrls,
        ...listingUrls,
      ];

      if (allUrls.length <= SITEMAP_MAX_URLS) {
        // Single sitemap
        const xml = this.generateSitemapXml(allUrls);
        await this.cacheSitemap(xml);
        return xml;
      }

      // Split into multiple sitemaps
      const parts: string[] = [];
      const sitemapPartUrls: string[] = [];

      for (let i = 0; i < allUrls.length; i += SITEMAP_MAX_URLS) {
        const chunk = allUrls.slice(i, i + SITEMAP_MAX_URLS);
        const partIndex = parts.length + 1;
        const partXml = this.generateSitemapXml(chunk);
        parts.push(partXml);
        sitemapPartUrls.push(`${SEO_BASE_URL}/sitemap-${partIndex}.xml`);

        // Cache each part
        await this.cacheSet(
          `${CACHE_KEY_SITEMAP}${partIndex}`,
          partXml,
          CACHE_TTL_SITEMAP,
        );
      }

      // Generate and cache the sitemap index
      const indexXml = this.generateSitemapIndex(sitemapPartUrls);
      await this.cacheSet(CACHE_KEY_SITEMAP_INDEX, indexXml, CACHE_TTL_SITEMAP);

      // Also cache the main sitemap key as the index
      await this.cacheSitemap(indexXml);

      return indexXml;
    } catch (error) {
      this.logger.error(`Sitemap generation failed: ${error}`);

      // Try to return last cached sitemap
      const cached = await this.getCachedSitemap();
      if (cached) {
        return cached;
      }

      // Fallback: minimal sitemap with home + static pages
      const staticUrls = this.buildStaticUrls();
      return this.generateSitemapXml(staticUrls);
    }
  }

  /**
   * Get a cached sitemap part by index (1-based).
   */
  async getCachedSitemapPart(index: number): Promise<string | null> {
    return this.cacheGet(`${CACHE_KEY_SITEMAP}${index}`);
  }

  /**
   * Get the cached main sitemap XML.
   */
  async getCachedSitemap(): Promise<string | null> {
    return this.cacheGet(`${CACHE_KEY_SITEMAP}main`);
  }

  /**
   * Cron job: regenerate the sitemap every 6 hours.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleSitemapCron(): Promise<void> {
    this.logger.log('Regenerating sitemap (scheduled)');
    try {
      await this.generateSitemap();
      this.logger.log('Sitemap regeneration complete');
    } catch (error) {
      this.logger.error(`Scheduled sitemap regeneration failed: ${error}`);
    }
  }

  /**
   * Cache the main sitemap XML in Redis.
   */
  private async cacheSitemap(xml: string): Promise<void> {
    await this.cacheSet(`${CACHE_KEY_SITEMAP}main`, xml, CACHE_TTL_SITEMAP);
  }

  /**
   * Escape special XML characters in a string.
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Try to get a string value from Redis cache. Returns null on miss or error.
   */
  private async cacheGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Redis cache GET failed for key "${key}": ${error}`);
      return null;
    }
  }

  /**
   * Try to set a string value in Redis cache. Logs and swallows errors.
   */
  private async cacheSet(
    key: string,
    value: string,
    ttl: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch (error) {
      this.logger.warn(`Redis cache SET failed for key "${key}": ${error}`);
    }
  }
}
