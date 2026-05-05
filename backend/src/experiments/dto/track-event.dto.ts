import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
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

  @IsOptional()
  @IsString()
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
