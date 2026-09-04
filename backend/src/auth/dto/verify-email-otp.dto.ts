import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Body for `POST /auth/verify-email-otp`, which was likewise declared as an
 * inline `{ otp: string }` type and therefore validated by nothing.
 */
export class VerifyEmailOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp!: string;
}
