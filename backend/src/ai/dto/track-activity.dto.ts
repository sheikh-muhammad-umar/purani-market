import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { UserAction } from '../schemas/user-activity.schema.js';

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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
