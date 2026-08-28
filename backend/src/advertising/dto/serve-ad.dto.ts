import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdDevice, AdEventType, AdPlacement } from '../advertising.enums.js';

/** Public request for an ad to fill one slot. */
export class ServeAdQueryDto {
  @IsEnum(AdPlacement)
  placement!: AdPlacement;

  /** Narrows targeting to the category the visitor is browsing. */
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  provinceId?: string;

  @IsOptional()
  @IsMongoId()
  cityId?: string;

  @IsOptional()
  @IsEnum(AdDevice)
  device?: AdDevice;

  /**
   * Anonymous client id. Used to collapse repeat impressions rather than to
   * identify anyone, so it is never persisted against a profile.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  /** How many creatives to return, for slots that show more than one. */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

/** Public report that a served creative was seen or clicked. */
export class RecordAdEventDto {
  @IsEnum(AdEventType)
  type!: AdEventType;

  @IsEnum(AdPlacement)
  placement!: AdPlacement;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
