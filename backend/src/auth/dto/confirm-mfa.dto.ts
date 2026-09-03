import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

/**
 * Proves the authenticator app was actually paired before MFA starts gating
 * logins. Without this step, `mfa/enable` was a one-way door: it turned the
 * requirement on whether or not the user ever scanned the QR code.
 */
export class ConfirmMfaDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  code!: string;
}
