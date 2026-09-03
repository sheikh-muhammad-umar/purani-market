export const BCRYPT_COST_FACTOR = 12;
export const EMAIL_TOKEN_EXPIRY_HOURS = 24;
export const PHONE_OTP_EXPIRY_MINUTES = 10;
export const EMAIL_OTP_EXPIRY_MINUTES = 10;
export const MAX_RESENDS_PER_HOUR = 5;
/** Max failed verification attempts allowed against a single OTP before it is invalidated. */
export const MAX_OTP_VERIFY_ATTEMPTS = 5;
export const UNVERIFIED_REMINDER_HOURS = 24;
export const MFA_MAX_FAILED_ATTEMPTS = 5;
export const MFA_FAILED_WINDOW_MINUTES = 15;
export const MFA_LOCKOUT_MINUTES = 30;
export const MFA_ISSUER = process.env.MFA_ISSUER || 'OnlineMarketplace';

/**
 * Lifetime of the ticket handed out when a password check succeeds but the
 * account still owes a TOTP code.
 *
 * Long enough to open an authenticator app and type six digits, short enough
 * that the ticket is worthless by the time it could leak out of a browser
 * history or a proxy log.
 */
export const MFA_TICKET_EXPIRATION = '5m';
export const MFA_TICKET_TTL_SECONDS = 5 * 60;
export const PASSWORD_RESET_EXPIRY_MINUTES = 30;
export const EMAIL_CHANGE_EXPIRY_HOURS = 24;
export const PHONE_CHANGE_OTP_EXPIRY_MINUTES = 10;
export const MAX_CHANGE_REQUESTS_PER_DAY = 3;
