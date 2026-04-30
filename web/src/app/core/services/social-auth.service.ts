import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SocialProvider } from '../enums/social-provider';
import {
  SocialToken,
  GoogleCredentialResponse,
  GooglePromptNotification,
  FacebookAuthResponse,
  AppleSignInResponse,
} from '../models/social-token.model';
import {
  SDK_URLS,
  SDK_SCRIPT_IDS,
  FACEBOOK_SDK_VERSION,
  GOOGLE_SCOPES,
  APPLE_SCOPES,
} from '../constants/social-sdk';

export type { SocialToken } from '../models/social-token.model';

declare const google: any;
declare const FB: any;
declare const AppleID: any;

@Injectable({ providedIn: 'root' })
export class SocialAuthService implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);

  private sdkLoaded: Record<SocialProvider, boolean> = {
    [SocialProvider.GOOGLE]: false,
    [SocialProvider.FACEBOOK]: false,
    [SocialProvider.APPLE]: false,
  };

  ngOnDestroy(): void {
    // Nothing to tear down — SDKs are global singletons managed by the browser
  }

  // ── Public API ────────────────────────────────────────────────

  signInWithGoogle(): Promise<SocialToken> {
    return this.loadSdk(SocialProvider.GOOGLE).then(
      () =>
        new Promise<SocialToken>((resolve, reject) => {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (response: GoogleCredentialResponse) => {
              if (response.credential) {
                resolve({
                  provider: SocialProvider.GOOGLE,
                  token: response.credential,
                });
              } else {
                reject(new Error('Google sign-in cancelled'));
              }
            },
          });

          google.accounts.id.prompt((notification: GooglePromptNotification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: environment.googleClientId,
                scope: GOOGLE_SCOPES,
                callback: (tokenResponse: { access_token?: string }) => {
                  if (tokenResponse.access_token) {
                    resolve({
                      provider: SocialProvider.GOOGLE,
                      token: tokenResponse.access_token,
                    });
                  } else {
                    reject(new Error('Google sign-in cancelled'));
                  }
                },
              });
              tokenClient.requestAccessToken();
            }
          });
        }),
    );
  }

  signInWithFacebook(): Promise<SocialToken> {
    return this.loadSdk(SocialProvider.FACEBOOK).then(
      () =>
        new Promise<SocialToken>((resolve, reject) => {
          FB.login(
            (response: FacebookAuthResponse) => {
              const accessToken = response.authResponse?.accessToken;
              if (accessToken) {
                resolve({
                  provider: SocialProvider.FACEBOOK,
                  token: accessToken,
                });
              } else {
                reject(new Error('Facebook sign-in cancelled'));
              }
            },
            { scope: 'email,public_profile' },
          );
        }),
    );
  }

  signInWithApple(): Promise<SocialToken> {
    return this.loadSdk(SocialProvider.APPLE).then(
      () =>
        new Promise<SocialToken>((resolve, reject) => {
          AppleID.auth.init({
            clientId: environment.appleClientId,
            scope: APPLE_SCOPES,
            redirectURI: `${window.location.origin}/auth/apple-callback`,
            usePopup: true,
          });

          AppleID.auth
            .signIn()
            .then((response: AppleSignInResponse) => {
              const idToken = response.authorization?.id_token;
              if (!idToken) {
                reject(new Error('Apple sign-in: no id_token'));
                return;
              }
              resolve({
                provider: SocialProvider.APPLE,
                token: idToken,
                firstName: response.user?.name?.firstName,
                lastName: response.user?.name?.lastName,
              });
            })
            .catch(() => reject(new Error('Apple sign-in cancelled')));
        }),
    );
  }

  // ── SDK Loader ────────────────────────────────────────────────

  private loadSdk(provider: SocialProvider): Promise<void> {
    if (!this.isBrowser) {
      return Promise.reject(new Error('Social SDKs are not available during SSR'));
    }

    if (this.sdkLoaded[provider]) {
      return Promise.resolve();
    }

    const scriptId = SDK_SCRIPT_IDS[provider];

    if (this.doc.getElementById(scriptId)) {
      this.sdkLoaded[provider] = true;
      return Promise.resolve();
    }

    if (provider === SocialProvider.FACEBOOK) {
      return this.loadFacebookSdk();
    }

    return new Promise<void>((resolve, reject) => {
      const script = this.doc.createElement('script');
      script.id = scriptId;
      script.src = SDK_URLS[provider];
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.sdkLoaded[provider] = true;
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${provider} SDK`));
      this.doc.head.appendChild(script);
    });
  }

  /** Facebook SDK uses a special async init callback pattern */
  private loadFacebookSdk(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      (window as unknown as Record<string, unknown>)['fbAsyncInit'] = () => {
        FB.init({
          appId: environment.facebookAppId,
          cookie: true,
          xfbml: false,
          version: FACEBOOK_SDK_VERSION,
        });
        this.sdkLoaded[SocialProvider.FACEBOOK] = true;
        resolve();
      };

      const script = this.doc.createElement('script');
      script.id = SDK_SCRIPT_IDS[SocialProvider.FACEBOOK];
      script.src = SDK_URLS[SocialProvider.FACEBOOK];
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
      this.doc.head.appendChild(script);
    });
  }
}
