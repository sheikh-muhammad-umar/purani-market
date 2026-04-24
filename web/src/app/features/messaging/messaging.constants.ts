/** Messaging feature constants shared across chat components. */

/** Accepted image MIME types for the file picker. */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Voice recording MIME type. */
export const VOICE_MIME_TYPE = 'audio/webm';

/** Messages per page for pagination. */
export const MESSAGES_PAGE_SIZE = 20;

/** Typing indicator auto-dismiss timeout in ms. */
export const TYPING_TIMEOUT_MS = 3000;

/** Scroll-to-bottom delay in ms. */
export const SCROLL_DELAY_MS = 50;

/** Default live location sharing duration in minutes. */
export const LIVE_LOCATION_DURATION_MIN = 15;

/** Skeleton placeholder indices for loading states. */
export const SKELETON_ITEMS = [1, 2, 3, 4, 5] as const;

/** Waveform bar indices for voice message visualization. */
export const WAVEFORM_BARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
