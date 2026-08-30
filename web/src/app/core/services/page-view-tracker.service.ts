import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ActivityTrackerService } from './activity-tracker.service';
import { TrackingEvent } from '../enums/tracking-events';

/**
 * Turns navigation into a page-view stream.
 *
 * `page_view` was already a defined action, in the guest allow-list and charted
 * by the engagement analytics, but nothing ever emitted it — so there was no
 * record of which pages people actually reach, and guest activity only showed up
 * once someone happened to open a listing or run a search.
 *
 * Views are keyed on the path alone. Query-only changes are ignored on purpose:
 * the search page rewrites its query string on every filter and page change, and
 * counting those as page views would bury the rest of the site in noise. Those
 * interactions are recorded as `search` and `filter_apply` instead.
 */
@Injectable({ providedIn: 'root' })
export class PageViewTrackerService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tracker = inject(ActivityTrackerService);
  private readonly router = inject(Router);

  private subscription?: Subscription;
  private lastPath?: string;

  /**
   * Begins tracking. Safe to call more than once; only the first call subscribes.
   *
   * Records the landing page immediately rather than waiting for the next
   * navigation. The initial navigation may resolve either side of this call, so
   * the path-level de-duplication is what keeps it to one view either way.
   */
  init(): void {
    if (!this.isBrowser || this.subscription) return;

    // Before anything else reads the session id, so the visit is opened with a
    // session_start carrying the device, referrer and campaign context.
    this.tracker.startSession();

    // `router.url` is still the default at this point when the app was loaded on
    // a deep link, which would attribute the landing view to "/". The address bar
    // already holds the real path.
    this.record(window.location.pathname);
    this.subscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.record(e.urlAfterRedirects));
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }

  private record(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    if (path === this.lastPath) return;

    const previousPath = this.lastPath;
    this.lastPath = path;

    this.tracker.track(TrackingEvent.PAGE_VIEW, {
      metadata: previousPath ? { path, previousPath } : { path },
    });
  }
}
