import { Component, signal, inject, output, input, OnDestroy } from '@angular/core';
import { VoiceSearchService } from '../../../core/services/voice-search.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { VOICE_ERROR_MESSAGES } from '../../../core/services/voice-search.types';
import {
  SWIPE_CANCEL_THRESHOLD,
  VOICE_ERROR_DISPLAY_DURATION,
  VOICE_CANCELLED_KEY,
  VOICE_LISTENING_LABEL,
  VOICE_HINT_LABEL,
} from './voice-search.constants';

@Component({
  selector: 'app-voice-search',
  standalone: true,
  templateUrl: './voice-search.component.html',
  styleUrls: ['./voice-search.component.scss'],
})
export class VoiceSearchComponent implements OnDestroy {
  /** Whether to use the mobile variant styling */
  readonly mobile = input(false);

  /** Emits the transcript when voice search completes successfully */
  readonly searched = output<string>();

  readonly voiceSearch = inject(VoiceSearchService);
  private readonly tracker = inject(ActivityTrackerService);

  readonly LISTENING_LABEL = VOICE_LISTENING_LABEL;
  readonly HINT_LABEL = VOICE_HINT_LABEL;

  readonly voiceSearchActive = signal(false);
  readonly voiceSearchError = signal('');

  private voiceSearchCancelled = false;
  private voiceTouchStartX = 0;
  private voiceTouchStartY = 0;
  private voiceErrorTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.voiceErrorTimeout) {
      clearTimeout(this.voiceErrorTimeout);
    }
  }

  /** Called on mousedown / touchstart — begins listening */
  onVoiceDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();

    if (!this.voiceSearch.isSupported()) {
      this.showVoiceError(VOICE_ERROR_MESSAGES['not-supported']);
      this.tracker.track(TrackingEvent.VOICE_SEARCH_ERROR, {
        metadata: { error: 'not-supported', mobile: this.mobile() },
      });
      return;
    }

    this.recordTouchStart(event);
    this.voiceSearchActive.set(true);
    this.voiceSearchCancelled = false;
    this.voiceSearchError.set('');

    this.tracker.track(TrackingEvent.VOICE_SEARCH_START, {
      metadata: { mobile: this.mobile() },
    });

    this.voiceSearch.startListening().then(
      (result) => {
        this.voiceSearchActive.set(false);
        if (result.transcript && !this.voiceSearchCancelled) {
          this.searched.emit(result.transcript);
          this.tracker.track(TrackingEvent.VOICE_SEARCH_COMPLETE, {
            searchQuery: result.transcript,
            metadata: { language: result.language, mobile: this.mobile() },
          });
        }
      },
      (error: Error) => {
        this.voiceSearchActive.set(false);
        if (error.message && error.message !== VOICE_CANCELLED_KEY) {
          this.showVoiceError(error.message);
          this.tracker.track(TrackingEvent.VOICE_SEARCH_ERROR, {
            metadata: { error: error.message, mobile: this.mobile() },
          });
        }
      },
    );
  }

  /** Called on mouseup / touchend — stops listening and triggers search */
  onVoiceUp(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    if (!this.voiceSearchActive() || this.voiceSearchCancelled) return;
    this.voiceSearch.stopAndFinalize();
  }

  /** Called on touchmove — detects swipe to cancel */
  onVoiceMove(event: TouchEvent): void {
    if (!this.voiceSearchActive() || this.voiceSearchCancelled) return;
    if (event.touches.length === 0) return;

    const dx = event.touches[0].clientX - this.voiceTouchStartX;
    const dy = event.touches[0].clientY - this.voiceTouchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > SWIPE_CANCEL_THRESHOLD) {
      this.cancelVoice('swipe');
    }
  }

  /** Called on mouseleave — cancel if user drags away on desktop */
  onVoiceLeave(): void {
    if (!this.voiceSearchActive()) return;
    this.cancelVoice('mouseleave');
  }

  private recordTouchStart(event: MouseEvent | TouchEvent): void {
    if (event instanceof TouchEvent && event.touches.length > 0) {
      this.voiceTouchStartX = event.touches[0].clientX;
      this.voiceTouchStartY = event.touches[0].clientY;
    } else if (event instanceof MouseEvent) {
      this.voiceTouchStartX = event.clientX;
      this.voiceTouchStartY = event.clientY;
    }
  }

  private cancelVoice(reason: 'swipe' | 'mouseleave'): void {
    this.voiceSearchCancelled = true;
    this.voiceSearch.cancelListening();
    this.voiceSearchActive.set(false);
    this.tracker.track(TrackingEvent.VOICE_SEARCH_CANCEL, {
      metadata: { reason, mobile: this.mobile() },
    });
  }

  private showVoiceError(message: string): void {
    this.voiceSearchError.set(message);
    if (this.voiceErrorTimeout) {
      clearTimeout(this.voiceErrorTimeout);
    }
    this.voiceErrorTimeout = setTimeout(
      () => this.voiceSearchError.set(''),
      VOICE_ERROR_DISPLAY_DURATION,
    );
  }
}
