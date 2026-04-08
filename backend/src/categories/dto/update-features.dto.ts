import { IsArray, IsString } from 'class-validator';

export class UpdateFeaturesDto {
  @IsArray()
  @IsString({ each: true })
  features!: string[];
}
