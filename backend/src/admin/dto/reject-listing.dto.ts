import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class RejectListingDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  rejectionReasonIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customNote?: string;
}
