import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { TabActivityService } from './tab-activity.service';
import { WebSocketService } from './websocket.service';
import { REALTIME_EVENT } from '../constants/realtime-events';

/** Shortest gap between reconciling refreshes when the visitor keeps returning. */
const MIN_REFRESH_INTERVAL_MS = 30_000;

/**
 * Tracks the unread notification count.
 *
 * Instead of making its own API call (which duplicated the bell component's
 * call), this service emits a `refreshRequested` event that the bell component
 * listens to. The bell fetches notifications (limit=10) and calls `setCount()`
 * with the `unreadCount` from the response — one call serves both the badge
 * number and the dropdown list.
 *
 * Two triggers, doing different jobs:
 *
 * - The socket delivers a notification the moment the server writes it, so the
 *   badge moves while the visitor is looking at the page.
 * - Returning to the tab reconciles, because a socket can be down, reconnecting,
 *   or have missed events while the laptop was asleep. Without this the count
 *   could sit wrong indefinitely.
 *
 * What replaced the old 60-second poll matters: a repeating interval kept
 * `ApplicationRef.isStable()` from ever emitting, which stalled hydration
 * app-wide and left the HTTP transfer cache serving stale responses for the
 * whole session. It also spent a request a minute on tabs nobody was watching,
 * and still left the badge up to a minute behind on the tab someone was.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCountService {
  readonly unreadCount = signal(0);

  /** Emits when a refresh is needed (socket push, visitor returned, or manual). */
  readonly refreshRequested = new Subject<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly tabActivity = inject(TabActivityService);
  private readonly ws = inject(WebSocketService);
  /**
   * Rebuilt on every `start()`, because an unsubscribed `Subscription` stays
   * closed — reusing one would silently drop the triggers after a logout and
   * login in the same page session.
   */
  private subscriptions: Subscription | null = null;
  private started = false;

  /** Begin watching for refresh triggers — safe to call multiple times. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.subscriptions = new Subscription();

    // The initial load is handled by the bell component's ngOnInit.
    this.subscriptions.add(
      this.ws.on(REALTIME_EVENT.NOTIFICATION).subscribe((): void => {
        // Moved straight away so the badge responds immediately; the refresh
        // that follows replaces this with the server's authoritative count.
        this.unreadCount.update((count) => count + 1);
        this.refreshRequested.next();
      }),
    );

    this.subscriptions.add(
      this.tabActivity
        .returns(MIN_REFRESH_INTERVAL_MS)
        .subscribe(() => this.refreshRequested.next()),
    );

    this.destroyRef.onDestroy(() => this.stop());
  }

  stop(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.started = false;
  }

  /** Called by the bell component when it receives fresh data or user marks as read */
  setCount(count: number): void {
    this.unreadCount.set(count);
  }
}
