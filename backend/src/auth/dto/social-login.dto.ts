import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SocialProvider } from '../../common/enums/social-provider.enum.js';

export { SocialProvider } from '../../common/enums/social-provider.enum.js';

const PROVIDER_VALIDATION_MSG = `Provider must be one of: ${Object.values(SocialProvider).join(', ')}`;

export class SocialLoginDto {
  @IsEnum(SocialProvider, { message: PROVIDER_VALIDATION_MSG })
  provider!: SocialProvider;

  @IsString({ message: 'Token is required' })
  token!: string;

  /** Apple Sign-In may not return email on subsequent logins; pass firstName/lastName from the first auth */
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
