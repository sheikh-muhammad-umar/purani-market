export type VoiceSearchState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceSearchResult {
  transcript: string;
  confidence: number;
  language: string;
}

export const VOICE_RECOGNITION_LANG = 'en-US';

export const VOICE_ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'No microphone found. Please check your device.',
  'not-allowed': 'Microphone access denied. Please allow microphone permission.',
  network: 'Network error. Please check your connection.',
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
