import { IsString, IsNotEmpty, IsMongoId, IsArray, IsOptional } from 'class-validator';

export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsMongoId()
  cityId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subareas?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockPhases?: string[];
}
