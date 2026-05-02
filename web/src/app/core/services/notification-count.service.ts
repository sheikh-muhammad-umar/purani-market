import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

const POLL_INTERVAL_MS = 60_000;

/**
 * Tracks the unread notification count.
 *
 * Instead of making its own API call (which duplicated the bell component's
 * call), this service now emits a `refreshRequested` event that the bell
 * component listens to. The bell fetches notifications (limit=10) and calls
 * `setCount()` with the `unreadCount` from the response — one call serves
 * both the badge number and the dropdown list.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCountService {
  readonly unreadCount = signal(0);

  /** Emits when a refresh is needed (polling tick or manual trigger). */
  readonly refreshRequested = new Subject<void>();

  private readonly destroyRef = inject(DestroyRef);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  /** Start polling — safe to call multiple times */
  start(): void {
    if (this.started) return;
    this.started = true;
    // The initial refresh is handled by the bell component's ngOnInit
    this.pollTimer = setInterval(() => this.refreshRequested.next(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => this.stop());
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.started = false;
  }

  /** Called by the bell component when it receives fresh data or user marks as read */
  setCount(count: number): void {
    this.unreadCount.set(count);
  }
}
