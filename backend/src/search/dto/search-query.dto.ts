import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SearchSortOption {
  RELEVANCE = 'relevance',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  // Legacy name fields (still accepted)
  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  blockPhase?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  vehicleBrandId?: string;

  /**
   * Brand name filter (e.g. `Apple`). Lets a shareable link like
   * `?brand=Apple` work without knowing the brand id. Matched against the
   * indexed `brandName`/`vehicleBrandName`, so it covers both plain and vehicle
   * brands. Ignored when a specific `brandId`/`vehicleBrandId` is supplied.
   */
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  /**
   * Variant name filter (e.g. `Revo V`). Mirrors `modelName`: listings store
   * `variantName`, and many rows have no `variantId`, so matching by name is
   * what actually finds results.
   */
  @IsOptional()
  @IsString()
  variantName?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  verifiedSeller?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsEnum(SearchSortOption)
  sort?: SearchSortOption;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  filters?: Record<string, any>;

  /** Score threshold for filtering low-relevance results (0.0-1.0). Set by A/B experiments. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreThreshold?: number;

  /** Alias for scoreThreshold — allows experiments to use either name */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  /** ES ranking weights from A/B experiment. Passed as JSON string. */
  @IsOptional()
  @IsString()
  rankingConfig?: string;

  // ─── A/B Experiment Parameters ───────────────────────────────────────
  // These are sent by the frontend experiment system and used for ranking tuning.

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  showCondition?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  showSellerBadge?: boolean;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  defaultSort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phraseBoost?: number;

  @IsOptional()
  @IsString()
  recencyScale?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  recencyWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  popularityViewWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  popularityFavWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  synonymBoost?: number;
}
