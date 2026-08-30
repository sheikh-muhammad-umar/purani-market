import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';
import { UserAction } from '../schemas/user-activity.schema.js';

/** Matches the cap applied in `boundedId`, so validation and storage agree. */
const MAX_ID_LENGTH = 64;

export class TrackActivityDto {
  @IsEnum(UserAction)
  action!: UserAction;

  @IsOptional()
  @IsString()
  productListingId?: string;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /**
   * Per-tab session id. Lets analytics group an entire visit — landing page,
   * searches, the listing that got contacted — instead of seeing loose events.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  sessionId?: string;

  /**
   * Long-lived browser id, shared with the experiments pipeline so a guest can
   * be followed across sessions and A/B results can be joined to behaviour.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ID_LENGTH)
  visitorId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
