export class SellerSeoDto {
  title!: string;
  description!: string;
  avatarUrl!: string;
  city!: string;
  memberSince!: Date;
  isVerified!: boolean;
  activeListingCount!: number;
  canonicalUrl!: string;
  personJsonLd!: Record<string, unknown>;
}
