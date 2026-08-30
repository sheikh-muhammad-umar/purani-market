export type VoiceSearchState = 'idle' | 'listening' | 'processing' | 'error';

export type VoiceSearchLanguage = 'en-US';

/**
 * The language the recogniser runs in.
 *
 * The Web Speech API recognises one language per session, and English is the
 * only one offered, so this is a constant rather than a user choice. Restoring a
 * second language means bringing back a selector and somewhere to persist the
 * choice, not just widening this value.
 */
export const VOICE_RECOGNITION_LANGUAGE: VoiceSearchLanguage = 'en-US';

/** Error message used when a session is deliberately abandoned. */
export const VOICE_CANCELLED_KEY = 'cancelled';

/**
 * How long to wait for the engine's `onend` after `stop()` before finalising
 * anyway, so a browser that never fires it cannot leave the promise pending.
 */
export const VOICE_FINALIZE_TIMEOUT = 1200;

export interface VoiceSearchResult {
  transcript: string;
  confidence: number;
  language: string;
}

export const VOICE_ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'No microphone found. Please check your device.',
  'not-allowed': 'Microphone access denied. Please allow microphone permission.',
  network: 'Network error. Please check your connection.',
  'language-not-supported': 'This browser cannot recognise English speech.',
  default: 'Voice recognition failed.',
  'not-supported': 'Voice search is not supported in this browser.',
  'start-failed': 'Failed to start voice recognition.',
};
