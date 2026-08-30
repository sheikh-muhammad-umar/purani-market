import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VoiceSearchService } from './voice-search.service';
import { VOICE_CANCELLED_KEY, VOICE_FINALIZE_TIMEOUT } from './voice-search.types';

/**
 * Minimal stand-in for the browser's SpeechRecognition. It records the language
 * it was asked to use and lets a test drive `onresult` / `onend` / `onerror`
 * with the same asynchronous ordering a real engine has: the final result and
 * `onend` arrive *after* `stop()` returns.
 */
class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;

  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  /** Language captured at the moment start() was called. */
  langAtStart: string[] = [];

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  start(): void {
    this.startCalls++;
    this.langAtStart.push(this.lang);
  }

  stop(): void {
    this.stopCalls++;
  }

  abort(): void {
    this.abortCalls++;
  }

  // --- test helpers ---
  emitResult(transcript: string, isFinal: boolean): void {
    this.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { length: 1, isFinal, 0: { transcript, confidence: 1 } },
      },
    });
  }

  emitEnd(): void {
    this.onend?.();
  }

  emitError(error: string): void {
    this.onerror?.({ error, message: error });
  }
}

describe('VoiceSearchService', () => {
  let service: VoiceSearchService;

  const create = () => {
    TestBed.configureTestingModule({ providers: [VoiceSearchService] });
    return TestBed.inject(VoiceSearchService);
  };
  const latest = () => MockSpeechRecognition.instances[MockSpeechRecognition.instances.length - 1];

  beforeEach(() => {
    MockSpeechRecognition.instances = [];
    localStorage.clear();
    TestBed.resetTestingModule();
    (window as any).SpeechRecognition = MockSpeechRecognition;
    vi.useFakeTimers();
    service = create();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).SpeechRecognition;
  });

  it('reports support when the browser exposes SpeechRecognition', () => {
    expect(service.isSupported()).toBe(true);
  });

  // --- recognition language ---
  it('runs recognition in English', () => {
    expect(service.language).toBe('en-US');
    void service.startListening();
    expect(latest().langAtStart[0]).toBe('en-US');
  });

  it('reports the English tag on the result', async () => {
    const pending = service.startListening();
    latest().emitResult('toyota corolla', true);
    service.stopAndFinalize();
    latest().emitEnd();
    const result = await pending;
    expect(result.transcript).toBe('toyota corolla');
    expect(result.language).toBe('en-US');
  });

  /**
   * Urdu was removed, along with the selector and the stored preference. A
   * previously saved choice must not resurrect it.
   */
  it('ignores a language left in storage by an older build', () => {
    localStorage.setItem('voice_search_language', 'ur-PK');
    TestBed.resetTestingModule();
    const fresh = create();
    expect(fresh.language).toBe('en-US');
    void fresh.startListening();
    expect(latest().langAtStart[0]).toBe('en-US');
  });

  // --- transcript is not clipped on stop ---
  it('keeps the final result the engine delivers after stop()', async () => {
    const pending = service.startListening();
    const rec = latest();
    rec.emitResult('toyota corolla', false);

    service.stopAndFinalize();
    expect(service.state()).toBe('processing');

    // Arrives only after stop(), which the old implementation discarded.
    rec.emitResult('toyota corolla automatic', true);
    rec.emitEnd();

    expect((await pending).transcript).toBe('toyota corolla automatic');
    expect(service.state()).toBe('idle');
  });

  it('finalises anyway when onend never arrives', async () => {
    const pending = service.startListening();
    latest().emitResult('honda civic', true);
    service.stopAndFinalize();

    vi.advanceTimersByTime(VOICE_FINALIZE_TIMEOUT + 10);

    expect((await pending).transcript).toBe('honda civic');
  });

  it('resolves when the engine stops on its own', async () => {
    const pending = service.startListening();
    latest().emitResult('suzuki alto', true);
    latest().emitEnd();

    expect((await pending).transcript).toBe('suzuki alto');
  });

  // --- session race / dangling promise ---
  it('rejects the superseded session instead of leaving it pending', async () => {
    const first = service.startListening();
    const settled = vi.fn();
    first.then(
      () => settled('resolved'),
      (e: Error) => settled(e.message),
    );

    service.startListening().catch(() => undefined);
    await Promise.resolve();

    expect(settled).toHaveBeenCalledWith(VOICE_CANCELLED_KEY);
  });

  it('ignores a stale onend from an abandoned session', async () => {
    const first = service.startListening();
    first.catch(() => undefined);
    const firstRec = latest();

    const second = service.startListening();
    const onSecond = vi.fn();
    second.then(onSecond, onSecond);

    // The abandoned recogniser fires its lifecycle callbacks late; they must not
    // settle the new session with an empty transcript.
    firstRec.emitEnd();
    await Promise.resolve();
    expect(onSecond).not.toHaveBeenCalled();
    expect(service.state()).toBe('listening');

    latest().emitResult('kia sportage', true);
    latest().emitEnd();
    expect((await second).transcript).toBe('kia sportage');
  });

  it('ignores a stale error from an abandoned session', async () => {
    const first = service.startListening();
    first.catch(() => undefined);
    const firstRec = latest();

    const second = service.startListening();
    const onSecond = vi.fn();
    second.then(onSecond, onSecond);

    firstRec.emitError('network');
    await Promise.resolve();

    expect(onSecond).not.toHaveBeenCalled();
    expect(service.state()).toBe('listening');
    expect(service.errorMessage()).toBe('');
  });

  // --- cancellation and errors ---
  it('rejects with the cancelled sentinel when cancelled', async () => {
    const pending = service.startListening();
    const onReject = vi.fn();
    pending.catch((e: Error) => onReject(e.message));

    service.cancelListening();
    await Promise.resolve();

    expect(onReject).toHaveBeenCalledWith(VOICE_CANCELLED_KEY);
    expect(service.state()).toBe('idle');
    expect(service.interimTranscript()).toBe('');
  });

  it('surfaces a friendly message for a recognition error', async () => {
    const pending = service.startListening();
    const onReject = vi.fn();
    pending.catch((e: Error) => onReject(e.message));

    latest().emitError('not-allowed');
    await Promise.resolve();

    expect(service.state()).toBe('error');
    expect(service.errorMessage()).toContain('Microphone access denied');
    expect(onReject).toHaveBeenCalled();
  });

  it('does not treat an abort as a user-facing error', () => {
    const pending = service.startListening();
    pending.catch(() => undefined);

    latest().emitError('aborted');

    expect(service.state()).toBe('idle');
    expect(service.errorMessage()).toBe('');
  });

  it('rejects when the browser has no SpeechRecognition', async () => {
    delete (window as any).SpeechRecognition;
    TestBed.resetTestingModule();
    const unsupported = create();

    expect(unsupported.isSupported()).toBe(false);
    await expect(unsupported.startListening()).rejects.toThrow(/not supported/i);
  });

  it('ignores stopAndFinalize when not listening', () => {
    service.stopAndFinalize();
    // No session has begun, so no recogniser was ever built.
    expect(MockSpeechRecognition.instances.length).toBe(0);
  });
});
