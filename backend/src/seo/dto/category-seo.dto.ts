import { BreadcrumbItem } from './breadcrumb-item.dto.js';

export class CategorySeoDto {
  title!: string;
  description!: string;
  breadcrumb!: BreadcrumbItem[];
  listingCount!: number;
  canonicalUrl!: string;
  itemListJsonLd!: Record<string, unknown>;
  breadcrumbJsonLd!: Record<string, unknown>;
}
