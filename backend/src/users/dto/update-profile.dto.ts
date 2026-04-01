import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsOptional()
  coordinates?: number[];
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @ValidateNested()
  @Type(() => UpdateLocationDto)
  @IsOptional()
  location?: UpdateLocationDto;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;
}
