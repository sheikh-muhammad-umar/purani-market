import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { OtpChannel } from '../../common/enums/otp-channel.enum.js';

export class ResendVerificationDto {
  @ValidateIf((o: ResendVerificationDto) => !o.phone)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ValidateIf((o: ResendVerificationDto) => !o.email)
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone number must be a valid international format',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(OtpChannel, { message: 'Channel must be "sms" or "whatsapp"' })
  channel?: OtpChannel;
}
