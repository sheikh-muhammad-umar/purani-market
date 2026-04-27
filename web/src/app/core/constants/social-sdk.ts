import { SocialProvider } from '../enums/social-provider';

export const SDK_URLS: Record<SocialProvider, string> = {
  [SocialProvider.GOOGLE]: 'https://accounts.google.com/gsi/client',
  [SocialProvider.FACEBOOK]: 'https://connect.facebook.net/en_US/sdk.js',
  [SocialProvider.APPLE]:
    'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
};

export const SDK_SCRIPT_IDS: Record<SocialProvider, string> = {
  [SocialProvider.GOOGLE]: 'google-gsi-script',
  [SocialProvider.FACEBOOK]: 'facebook-jssdk',
  [SocialProvider.APPLE]: 'apple-signin-script',
};

export const FACEBOOK_SDK_VERSION = 'v19.0';
export const GOOGLE_SCOPES = 'openid email profile';
export const APPLE_SCOPES = 'name email';
