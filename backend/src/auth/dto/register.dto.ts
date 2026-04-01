import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ValidateIf((o: RegisterDto) => !o.phone)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ValidateIf((o: RegisterDto) => !o.email)
  @IsString({ message: 'Please provide a valid phone number' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone number must be a valid international format (e.g. +923001234567)',
  })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;
}
