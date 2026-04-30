export class PageSeoDto {
  title!: string;
  description!: string;
  canonicalUrl!: string;
  ogType!: 'website' | 'product' | 'profile';
  faqJsonLd?: Record<string, unknown>;
}
