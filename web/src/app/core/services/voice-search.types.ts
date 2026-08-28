export type VoiceSearchState = 'idle' | 'listening' | 'processing' | 'error';

/** Languages the recogniser can be switched between. */
export type VoiceSearchLanguage = 'en-US' | 'ur-PK';

export interface VoiceLanguageOption {
  code: VoiceSearchLanguage;
  /** Full name, used for accessible labels. */
  label: string;
  /** Compact badge text for the toggle button. */
  short: string;
}

/**
 * The Web Speech API recognises one language per session — it has no
 * multi-language mode — so the language is an explicit user choice rather than
 * something inferred while listening.
 */
export const VOICE_LANGUAGES: VoiceLanguageOption[] = [
  { code: 'en-US', label: 'English', short: 'EN' },
  { code: 'ur-PK', label: 'Urdu', short: 'اردو' },
];

export const DEFAULT_VOICE_LANGUAGE: VoiceSearchLanguage = 'en-US';

/** localStorage key holding the last chosen recognition language. */
export const VOICE_LANGUAGE_STORAGE_KEY = 'voice_search_language';

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
  'language-not-supported': 'This browser cannot recognise the selected language.',
  default: 'Voice recognition failed.',
  'not-supported': 'Voice search is not supported in this browser.',
  'start-failed': 'Failed to start voice recognition.',
};

/** Unicode regex for Arabic/Urdu script detection */
const URDU_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Detects whether text contains Urdu/Arabic script characters. */
export function containsUrduScript(text: string): boolean {
  return URDU_SCRIPT_REGEX.test(text);
}

/** Whether a stored value is a language this service supports. */
export function isVoiceSearchLanguage(value: unknown): value is VoiceSearchLanguage {
  return VOICE_LANGUAGES.some((option) => option.code === value);
}
