export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  /**
   * The user opted into ID verification while signing up. Uploading needs a
   * session that registration does not create, so the server records the request
   * and the first sign-in picks it up from there.
   */
  wantsIdVerification?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

export interface MfaEnableResponse {
  qrCodeUrl: string;
  secret: string;
}

export type LoginResponse = AuthTokens | MfaRequiredResponse;
