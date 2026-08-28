/** Distance in pixels a touch must travel to cancel voice search */
export const SWIPE_CANCEL_THRESHOLD = 60;

/** Duration in ms to display voice error messages */
export const VOICE_ERROR_DISPLAY_DURATION = 3000;

/**
 * Error key used when voice search is manually cancelled.
 *
 * Re-exported from the service types so the producer and the consumer of this
 * sentinel cannot drift apart.
 */
export { VOICE_CANCELLED_KEY } from '../../../core/services/voice-search.types';

/** Fallback text shown while listening for speech */
export const VOICE_LISTENING_LABEL = 'Listening...';

/** Hint text shown during active voice recording */
export const VOICE_HINT_LABEL = 'Release to search · Swipe to cancel';
