/** localStorage / sessionStorage key constants */

// App download banner
export const STORAGE_APP_BANNER_DISMISSED = 'app_banner_dismissed';
export const STORAGE_APP_BANNER_SHOWN = 'app_banner_shown_session';

// Location
export const STORAGE_SELECTED_LOCATION = 'selected_location';

// Theme
export const STORAGE_THEME = 'theme';

// Auth
export const STORAGE_ACCESS_TOKEN = 'access_token';
export const STORAGE_REFRESH_TOKEN = 'refresh_token';

// Search preferences
export const STORAGE_MOBILE_COLUMNS = 'search_mobile_columns';

// Analytics identity
/**
 * Long-lived browser id. Shared by activity tracking, experiments and ads.
 *
 * The value predates this constant — it was created inline by the experiments
 * service — so the key must stay `mp_visitor_id` or every returning visitor gets
 * reshuffled into a different A/B variant.
 */
export const STORAGE_VISITOR_ID = 'mp_visitor_id';

/** Per-tab session id, kept in sessionStorage so a new tab starts a new visit. */
export const STORAGE_SESSION_ID = 'mp_session_id';

// ID verification onboarding
/**
 * Marks that we already sent this user to the ID step after signing in.
 *
 * The request itself lives on the account (`wantsIdVerification`), because it is
 * made during registration and has to survive email or phone confirmation and a
 * separate sign-in. This key only stops the redirect repeating: without it,
 * someone who opted in and then decided to skip would be pushed back to the ID
 * step on every single sign-in.
 */
export const STORAGE_IDV_PROMPTED = 'mp_idv_prompted';
