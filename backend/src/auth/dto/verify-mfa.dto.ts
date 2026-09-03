import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class VerifyMfaDto {
  /**
   * The ticket returned by `POST /auth/login` when the account has MFA on.
   *
   * This used to be a plain `userId`, which meant the endpoint asked for no
   * evidence that the password step had happened: a user id is not a secret —
   * it ships in listing and review payloads — so anyone holding a TOTP code
   * could exchange it for a session and the second factor was the only factor.
   * The ticket is a signed, single-use, short-lived token, so reaching this
   * endpoint now requires having passed the password check.
   */
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  code!: string;
}
