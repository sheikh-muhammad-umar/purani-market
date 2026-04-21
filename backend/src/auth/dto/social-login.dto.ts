import { IsEnum, IsString } from 'class-validator';

export enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

export class SocialLoginDto {
  @IsEnum(SocialProvider, {
    message: 'Provider must be "google" or "facebook"',
  })
  provider!: SocialProvider;

  @IsString({ message: 'Token is required' })
  token!: string;
}
