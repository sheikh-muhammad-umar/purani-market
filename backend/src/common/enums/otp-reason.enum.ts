/** Why an OTP / verification token was generated */
export enum OtpReason {
  REGISTRATION = 'registration',
  RESEND = 'resend',
  PASSWORD_RESET = 'password_reset',
  EMAIL_CHANGE = 'email_change',
  PHONE_CHANGE = 'phone_change',
}
