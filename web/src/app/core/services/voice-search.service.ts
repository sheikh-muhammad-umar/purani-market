import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DEFAULT_VOICE_LANGUAGE,
  VOICE_CANCELLED_KEY,
  VOICE_ERROR_MESSAGES,
  VOICE_FINALIZE_TIMEOUT,
  VOICE_LANGUAGE_STORAGE_KEY,
  VoiceSearchLanguage,
  VoiceSearchResult,
  VoiceSearchState,
  containsUrduScript,
  isVoiceSearchLanguage,
} from './voice-search.types';

// Web Speech API type declarations (not included in all lib.dom.d.ts versions)
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

@Injectable({ providedIn: 'root' })
export class VoiceSearchService {
  readonly state = signal<VoiceSearchState>('idle');
  readonly isSupported = signal(false);
  readonly errorMessage = signal('');
  readonly detectedLanguage = signal<'ur' | 'en' | null>(null);
  readonly interimTranscript = signal('');
  readonly finalTranscript = signal('');

  /**
   * Language the recogniser runs in.
   *
   * This used to be hardcoded to English while the service still claimed to
   * detect Urdu. An `en-US` engine never emits Arabic script, so the detection
   * could not fire and Urdu speech was simply mis-transcribed. The language is
   * now an explicit, persisted choice, because the Web Speech API recognises
   * exactly one language per session.
   */
  readonly language = signal<VoiceSearchLanguage>(DEFAULT_VOICE_LANGUAGE);

  private recognition: SpeechRecognition | null = null;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private resolvePromise: ((result: VoiceSearchResult) => void) | null = null;
  private rejectPromise: ((error: Error) => void) | null = null;

  /**
   * Incremented for every session. A single `SpeechRecognition` instance is
   * reused, and `abort()`/`stop()` fire `onend`/`onerror` asynchronously, so
   * without this a stale callback from an abandoned session could settle the
   * next session's promise. Handlers capture their id and ignore anything that
   * arrives after they have been superseded.
   */
  private sessionId = 0;
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.isBrowser) return;
    this.isSupported.set(!!this.getRecognitionCtor());
    this.language.set(this.readStoredLanguage());
  }

  private getRecognitionCtor(): any {
    if (!this.isBrowser) return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }

  /**
   * Builds a recogniser for one session.
   *
   * A single instance used to be shared across sessions. Because `abort()` and
   * `stop()` deliver `onend`/`onerror` asynchronously, and each new session
   * replaced the handlers on that shared object, a late callback from an
   * abandoned session invoked the *current* handler and resolved the new
   * session's promise with an empty transcript — the mic appeared to do nothing
   * when pressed twice quickly. Giving every session its own instance lets the
   * discarded one be detached completely.
   */
  private createRecognition(): SpeechRecognition | null {
    const Ctor = this.getRecognitionCtor();
    if (!Ctor) return null;
    const recognition: SpeechRecognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  /** Detaches every callback so a pending event from this instance is inert. */
  private detach(recognition: SpeechRecognition | null): void {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  }

  /** Switches recognition language and remembers the choice. */
  setLanguage(language: VoiceSearchLanguage): void {
    this.language.set(language);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Private browsing or a full quota: the in-memory choice still applies.
    }
  }

  startListening(): Promise<VoiceSearchResult> {
    if (!this.getRecognitionCtor()) {
      this.state.set('error');
      this.errorMessage.set(VOICE_ERROR_MESSAGES['not-supported']);
      return Promise.reject(new Error(VOICE_ERROR_MESSAGES['not-supported']));
    }

    // Abandon anything still running, rejecting its promise so the previous
    // caller is not left waiting forever.
    if (this.state() === 'listening' || this.state() === 'processing') {
      this.discardSession();
    }

    const session = ++this.sessionId;
    this.recognition = this.createRecognition();

    this.recognition!.lang = this.language();
    this.state.set('listening');
    this.errorMessage.set('');
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.detectedLanguage.set(null);

    return new Promise<VoiceSearchResult>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
        if (session !== this.sessionId) return;

        let interim = '';
        let final = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        this.finalTranscript.set(final.trim());
        this.interimTranscript.set(interim.trim() || final.trim());

        const currentText = interim || final;
        if (currentText.trim()) {
          this.detectedLanguage.set(this.resolveLanguageTag(currentText));
        }
      };

      this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (session !== this.sessionId) return;

        if (event.error === 'aborted') {
          this.state.set('idle');
          return;
        }
        const message = VOICE_ERROR_MESSAGES[event.error] ?? VOICE_ERROR_MESSAGES['default'];
        this.clearFinalizeTimer();
        this.state.set('error');
        this.errorMessage.set(message);
        this.rejectPromise?.(new Error(message));
        this.resetPromises();
      };

      this.recognition!.onend = () => {
        if (session !== this.sessionId) return;
        // Covers both a natural end (silence) and the end that follows stop().
        if (this.state() === 'listening' || this.state() === 'processing') {
          this.finalize();
        }
      };

      try {
        this.recognition!.start();
      } catch (e: any) {
        if (e?.message?.includes('already started')) {
          this.state.set('idle');
          reject(new Error(VOICE_CANCELLED_KEY));
        } else {
          this.state.set('error');
          this.errorMessage.set(VOICE_ERROR_MESSAGES['start-failed']);
          reject(e);
        }
        this.resetPromises();
      }
    });
  }

  /**
   * Ends capture and resolves with the transcript.
   *
   * The engine delivers its last final result *after* `stop()`, so finalising
   * synchronously here used to discard it and clip the final word. The session
   * now waits for `onend`, with a timer as a backstop.
   */
  stopAndFinalize(): void {
    if (!this.recognition || this.state() !== 'listening') return;

    this.state.set('processing');
    const session = this.sessionId;

    try {
      this.recognition.stop();
    } catch {
      this.finalize();
      return;
    }

    this.clearFinalizeTimer();
    this.finalizeTimer = setTimeout(() => {
      if (session === this.sessionId && this.state() === 'processing') {
        this.finalize();
      }
    }, VOICE_FINALIZE_TIMEOUT);
  }

  cancelListening(): void {
    if (this.state() !== 'listening' && this.state() !== 'processing') return;
    this.discardSession();
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.detectedLanguage.set(null);
  }

  /** Invalidates the running session and rejects its pending promise. */
  private discardSession(): void {
    this.sessionId++;
    this.clearFinalizeTimer();
    this.rejectPromise?.(new Error(VOICE_CANCELLED_KEY));
    this.resetPromises();

    const abandoned = this.recognition;
    this.recognition = null;
    // Detach before aborting: abort() fires callbacks asynchronously and they
    // must not touch the session that replaces this one.
    this.detach(abandoned);
    try {
      abandoned?.abort();
    } catch {
      // Aborting an already-stopped recogniser is not an error worth surfacing.
    }
    this.state.set('idle');
  }

  private finalize(): void {
    this.clearFinalizeTimer();
    this.detach(this.recognition);
    const transcript = this.finalTranscript() || this.interimTranscript();
    const detected = this.resolveLanguageTag(transcript);
    this.detectedLanguage.set(detected);
    this.state.set('idle');

    this.resolvePromise?.({
      transcript: transcript.trim(),
      confidence: 1,
      language: this.language(),
    });
    this.resetPromises();
  }

  /**
   * Which script the transcript actually came back in. The selected language is
   * the default answer; script detection still runs so a mixed or unexpected
   * result is reported accurately.
   */
  private resolveLanguageTag(text: string): 'ur' | 'en' {
    if (containsUrduScript(text)) return 'ur';
    return this.language() === 'ur-PK' ? 'ur' : 'en';
  }

  private readStoredLanguage(): VoiceSearchLanguage {
    try {
      const stored = localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY);
      return isVoiceSearchLanguage(stored) ? stored : DEFAULT_VOICE_LANGUAGE;
    } catch {
      return DEFAULT_VOICE_LANGUAGE;
    }
  }

  private clearFinalizeTimer(): void {
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }
  }

  private resetPromises(): void {
    this.resolvePromise = null;
    this.rejectPromise = null;
  }
}
