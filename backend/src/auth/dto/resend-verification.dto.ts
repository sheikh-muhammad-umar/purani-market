import { IsEmail, IsString, Matches, ValidateIf } from 'class-validator';

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
}
