import { SocialProvider } from '../enums/social-provider';

export interface SocialToken {
  provider: SocialProvider;
  token: string;
  firstName?: string;
  lastName?: string;
}

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

export interface GooglePromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

export interface FacebookAuthResponse {
  authResponse?: { accessToken?: string };
  status?: string;
}

export interface AppleSignInResponse {
  authorization?: { id_token?: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}
