import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  VoiceSearchState,
  VoiceSearchResult,
  VOICE_RECOGNITION_LANG,
  VOICE_ERROR_MESSAGES,
  containsUrduScript,
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

  private recognition: SpeechRecognition | null = null;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private resolvePromise: ((result: VoiceSearchResult) => void) | null = null;
  private rejectPromise: ((error: Error) => void) | null = null;

  constructor() {
    if (this.isBrowser) {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.isSupported.set(!!SpeechRecognitionCtor);

      if (SpeechRecognitionCtor) {
        this.recognition = new SpeechRecognitionCtor();
        this.recognition!.continuous = true;
        this.recognition!.interimResults = true;
        this.recognition!.maxAlternatives = 1;
      }
    }
  }

  startListening(): Promise<VoiceSearchResult> {
    if (!this.recognition) {
      this.state.set('error');
      this.errorMessage.set(VOICE_ERROR_MESSAGES['not-supported']);
      return Promise.reject(new Error(VOICE_ERROR_MESSAGES['not-supported']));
    }

    if (this.state() === 'listening') {
      this.recognition.abort();
      this.resetPromises();
      this.state.set('idle');
    }

    this.recognition.lang = VOICE_RECOGNITION_LANG;
    this.state.set('listening');
    this.errorMessage.set('');
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.detectedLanguage.set(null);

    return new Promise<VoiceSearchResult>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;

      this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
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
          this.detectedLanguage.set(containsUrduScript(currentText) ? 'ur' : 'en');
        }
      };

      this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted') {
          this.state.set('idle');
          return;
        }
        const message = VOICE_ERROR_MESSAGES[event.error] ?? VOICE_ERROR_MESSAGES['default'];
        this.state.set('error');
        this.errorMessage.set(message);
        this.rejectPromise?.(new Error(message));
        this.resetPromises();
      };

      this.recognition!.onend = () => {
        if (this.state() === 'listening' && this.resolvePromise) {
          this.finalize();
        }
      };

      try {
        this.recognition!.start();
      } catch (e: any) {
        if (e?.message?.includes('already started')) {
          this.state.set('idle');
          reject(new Error('cancelled'));
        } else {
          this.state.set('error');
          this.errorMessage.set(VOICE_ERROR_MESSAGES['start-failed']);
          reject(e);
        }
        this.resetPromises();
      }
    });
  }

  stopAndFinalize(): void {
    if (this.recognition && this.state() === 'listening') {
      this.recognition.stop();
      this.finalize();
    }
  }

  cancelListening(): void {
    if (this.recognition && this.state() === 'listening') {
      this.recognition.abort();
      this.state.set('idle');
      this.interimTranscript.set('');
      this.finalTranscript.set('');
      this.detectedLanguage.set(null);
      this.rejectPromise?.(new Error('cancelled'));
      this.resetPromises();
    }
  }

  private finalize(): void {
    const transcript = this.finalTranscript() || this.interimTranscript();
    const detected = containsUrduScript(transcript) ? 'ur' : 'en';
    this.detectedLanguage.set(detected);
    this.state.set('idle');

    this.resolvePromise?.({
      transcript: transcript.trim(),
      confidence: 1,
      language: detected === 'ur' ? 'ur-PK' : VOICE_RECOGNITION_LANG,
    });
    this.resetPromises();
  }

  private resetPromises(): void {
    this.resolvePromise = null;
    this.rejectPromise = null;
  }
}
