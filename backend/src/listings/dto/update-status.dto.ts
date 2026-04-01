import { IsEnum } from 'class-validator';
import { ListingStatus } from '../schemas/product-listing.schema.js';

export enum AllowedStatusTransition {
  SOLD = 'sold',
  RESERVED = 'reserved',
  INACTIVE = 'inactive',
  ACTIVE = 'active',
}

export class UpdateStatusDto {
  @IsEnum(AllowedStatusTransition)
  status!: AllowedStatusTransition;
}
