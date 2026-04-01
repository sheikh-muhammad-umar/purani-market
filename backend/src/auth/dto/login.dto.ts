import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ValidateIf((o: LoginDto) => !o.phone)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ValidateIf((o: LoginDto) => !o.email)
  @IsString({ message: 'Please provide a valid phone number' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'Phone number must be a valid international format',
  })
  @IsOptional()
  phone?: string;

  @IsString()
  password!: string;
}
