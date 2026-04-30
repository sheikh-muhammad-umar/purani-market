export class HomeSeoDto {
  title!: string;
  description!: string;
  featuredCategories!: string[];
  canonicalUrl!: string;
  websiteJsonLd!: Record<string, unknown>;
  organizationJsonLd!: Record<string, unknown>;
}
