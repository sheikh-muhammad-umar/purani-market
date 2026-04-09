import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class UpdateAreaDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subareas?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockPhases?: string[];
}
