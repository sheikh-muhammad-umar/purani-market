/** An image entry for the Google image sitemap extension. */
export class SitemapImage {
  loc!: string;
  title?: string;
}

/** A video entry for the Google video sitemap extension. */
export class SitemapVideo {
  thumbnailLoc!: string;
  title!: string;
  description!: string;
  /** Direct URL to the video file (video:content_loc). */
  contentLoc?: string;
  /** Player/watch page URL (video:player_loc). */
  playerLoc?: string;
  durationSeconds?: number;
  publicationDate?: string;
  viewCount?: number;
}

export class SitemapUrl {
  loc!: string;
  lastmod?: string;
  changefreq?: string;
  priority!: number;
  /** Optional image extensions (Google image sitemap). */
  images?: SitemapImage[];
  /** Optional video extensions (Google video sitemap). */
  videos?: SitemapVideo[];
}
