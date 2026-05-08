import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ShortVideoStatus } from '../schemas/short-video.schema.js';

export class UpdateShortStatusDto {
  @IsEnum(ShortVideoStatus)
  status!: ShortVideoStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
