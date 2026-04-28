import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NotificationChannel,
  NotificationAudience,
} from '../schemas/notification.schema.js';

export class SendNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  htmlBody?: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsEnum(NotificationAudience)
  audience!: NotificationAudience;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsString()
  category?: string;
}
