import { BreadcrumbItem } from './breadcrumb-item.dto.js';

/** SEO metadata for a single short video detail view. */
export class ShortSeoDto {
  title!: string;
  description!: string;
  /** Poster/thumbnail image used for og:image and VideoObject.thumbnailUrl. */
  imageUrl!: string;
  /** Direct video content URL, used for og:video and VideoObject.contentUrl. */
  videoUrl!: string;
  /** Page the short is watched on, used for og:video:url / player embed. */
  embedUrl!: string;
  sellerName!: string;
  uploadDate!: string;
  canonicalUrl!: string;
  categoryBreadcrumb!: BreadcrumbItem[];
  videoJsonLd!: Record<string, unknown>;
  breadcrumbJsonLd!: Record<string, unknown>;
}
