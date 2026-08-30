import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, filter } from 'rxjs';

/**
 * Emits when the visitor comes back to the tab.
 *
 * This exists so background refreshes can be driven by attention rather than by a
 * clock. A repeating `setInterval` keeps `ApplicationRef.isStable()` from ever
 * emitting, and hydration waits on exactly that signal — so a poll that runs
 * whether or not anyone is looking both stalls hydration and burns requests on
 * hidden tabs.
 *
 * Deliberately timer-free: the throttle compares timestamps rather than
 * scheduling anything, so nothing here can hold the zone busy.
 */
@Injectable({ providedIn: 'root' })
export class TabActivityService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly returned = new Subject<void>();
  private listening = false;

  /**
   * Fires when the tab becomes visible or the window regains focus, at most once
   * per `minIntervalMs`.
   *
   * Both events are watched because they answer different questions: switching
   * tabs changes visibility, while moving between windows or desktops only
   * changes focus. The throttle is what stops a burst of alt-tabbing from
   * becoming a burst of requests.
   */
  returns(minIntervalMs = 0): Observable<void> {
    this.listen();

    let last = 0;
    return this.returned.pipe(
      filter(() => {
        const now = Date.now();
        if (now - last < minIntervalMs) return false;
        last = now;
        return true;
      }),
    );
  }

  private listen(): void {
    if (this.listening || !this.isBrowser) return;
    this.listening = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.returned.next();
    });
    window.addEventListener('focus', () => this.returned.next());
  }
}
