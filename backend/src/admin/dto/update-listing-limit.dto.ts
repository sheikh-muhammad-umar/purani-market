import { IsInt, Min } from 'class-validator';

export class UpdateListingLimitDto {
  @IsInt()
  @Min(0)
  listingLimit!: number;
}
