import { BreadcrumbItem } from './breadcrumb-item.dto.js';

export class ListingSeoDto {
  title!: string;
  description!: string;
  imageUrl!: string;
  price!: number;
  currency!: string;
  categoryBreadcrumb!: BreadcrumbItem[];
  sellerName!: string;
  averageRating!: number | null;
  reviewCount!: number;
  canonicalUrl!: string;
  productJsonLd!: Record<string, unknown>;
  breadcrumbJsonLd!: Record<string, unknown>;
}
