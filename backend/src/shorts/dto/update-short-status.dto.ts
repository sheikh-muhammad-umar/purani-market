import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ShortVideoStatus } from '../schemas/short-video.schema.js';

export class UpdateShortStatusDto {
  @IsOptional()
  @IsEnum(ShortVideoStatus)
  status?: ShortVideoStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

/** Reject requires a reason the seller can act on, so it has its own DTO. */
export class RejectShortDto {
  @IsString()
  @MaxLength(500)
  rejectionReason!: string;
}
