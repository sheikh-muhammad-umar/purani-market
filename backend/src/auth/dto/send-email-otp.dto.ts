import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Body for `POST /auth/send-email-otp`.
 *
 * The route previously declared its body as an inline `{ targetEmail?: string }`
 * type. A bare type annotation gives the ValidationPipe no class to inspect, so
 * it validated nothing at all: `targetEmail` was never checked to be an email
 * address, and `forbidNonWhitelisted` had no whitelist to enforce.
 */
export class SendEmailOtpDto {
  /** Omit to send a code to the address already on the account. */
  @IsEmail()
  @IsOptional()
  targetEmail?: string;

  /**
   * The account password, required only when `targetEmail` differs from the
   * current address — that case moves where password resets are delivered, so it
   * is an account handover rather than a verification.
   */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  password?: string;
}
