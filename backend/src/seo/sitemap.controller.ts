import {
  Controller,
  Get,
  Header,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { SitemapService } from './sitemap.service.js';

@Controller()
export class SitemapController {
  private readonly logger = new Logger(SitemapController.name);

  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * Serve the main sitemap XML.
   * Returns cached sitemap if available, otherwise triggers generation.
   * On failure, returns last cached version or a minimal sitemap with home + static pages.
   */
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async getSitemap(): Promise<string> {
    try {
      const cached = await this.sitemapService.getCachedSitemap();
      if (cached) {
        return cached;
      }

      return await this.sitemapService.generateSitemap();
    } catch (error) {
      this.logger.error(`Failed to serve sitemap.xml: ${error}`);

      // Try returning last cached sitemap
      try {
        const fallback = await this.sitemapService.getCachedSitemap();
        if (fallback) {
          return fallback;
        }
      } catch {
        // Cache also failed, fall through to minimal sitemap
      }

      // Return minimal sitemap with home + static pages
      const staticUrls = this.sitemapService.buildStaticUrls();
      return this.sitemapService.generateSitemapXml(staticUrls);
    }
  }

  /**
   * Serve an individual sitemap part for split sitemaps.
   * Returns the cached part by index, or triggers full generation if not cached.
   */
  @Get('sitemap-:index.xml')
  @Header('Content-Type', 'application/xml')
  async getSitemapPart(@Param('index') index: string): Promise<string> {
    const partIndex = parseInt(index, 10);
    if (isNaN(partIndex) || partIndex < 1) {
      throw new NotFoundException(`Sitemap part "${index}" not found`);
    }

    try {
      const cached = await this.sitemapService.getCachedSitemapPart(partIndex);
      if (cached) {
        return cached;
      }

      // No cached part — trigger full generation and try again
      await this.sitemapService.generateSitemap();
      const generated =
        await this.sitemapService.getCachedSitemapPart(partIndex);
      if (generated) {
        return generated;
      }

      throw new NotFoundException(`Sitemap part ${partIndex} not found`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to serve sitemap-${partIndex}.xml: ${error}`);

      // Try returning cached part as fallback
      try {
        const fallback =
          await this.sitemapService.getCachedSitemapPart(partIndex);
        if (fallback) {
          return fallback;
        }
      } catch {
        // Cache also failed
      }

      throw new NotFoundException(`Sitemap part ${partIndex} not found`);
    }
  }
}
