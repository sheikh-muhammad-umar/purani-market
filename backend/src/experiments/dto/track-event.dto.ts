import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
  Min,
} from 'class-validator';
import { ExperimentEventType } from '../schemas/experiment-event.schema.js';

export class TrackEventDto {
  @IsString()
  experimentKey!: string;

  @IsString()
  variantId!: string;

  @IsEnum(ExperimentEventType)
  eventType!: ExperimentEventType;

  @IsOptional()
  @IsString()
  visitorId?: string;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  // Validated as a Mongo ObjectId: trackEvent constructs `new Types.ObjectId`
  // from this, which throws (unhandled 500) on a malformed value.
  @IsOptional()
  @IsMongoId()
  listingId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalResults?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
