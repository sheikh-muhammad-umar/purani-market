import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Turning MFA off is a downgrade of the account's own protection, so it asks for
 * the password again rather than accepting the access token alone — otherwise a
 * stolen or XSS-lifted token was enough to strip the second factor and the
 * feature protected nothing against the attack it exists for.
 *
 * The password is requested rather than a TOTP code on purpose: someone who has
 * lost their authenticator device still needs a way out, and the alternative
 * (recovery codes) does not exist in this codebase yet.
 */
export class DisableMfaDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
