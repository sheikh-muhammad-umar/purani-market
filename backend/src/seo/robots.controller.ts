import { Controller, Get, Header } from '@nestjs/common';
import {
  SEO_BASE_URL,
  ROBOTS_ALLOWED_PATHS,
  ROBOTS_DISALLOWED_PATHS,
  ROBOTS_CRAWL_DELAY,
} from '../common/constants/index.js';

@Controller()
export class RobotsController {
  /**
   * Serve robots.txt with crawl directives for search engine crawlers.
   * Allows public pages and disallows private/user-specific pages.
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  getRobotsTxt(): string {
    const lines: string[] = ['User-agent: *'];

    for (const path of ROBOTS_ALLOWED_PATHS) {
      lines.push(`Allow: ${path}`);
    }

    for (const path of ROBOTS_DISALLOWED_PATHS) {
      lines.push(`Disallow: ${path}`);
    }

    lines.push(`Crawl-delay: ${ROBOTS_CRAWL_DELAY}`);
    lines.push(`Sitemap: ${SEO_BASE_URL}/sitemap.xml`);

    return lines.join('\n');
  }
}
