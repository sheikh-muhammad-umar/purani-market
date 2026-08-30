import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from '../auth/auth.service';
import { SelectedLocationService } from './selected-location.service';
import { VisitorIdentityService } from './visitor-identity.service';
import { UserAction, ANONYMOUS_TRACKED_ACTIONS, TrackingEvent } from '../enums/tracking-events';
import { API } from '../constants/api-endpoints';
import { GEO_TIMEOUT_MS, GEO_MAX_AGE_MS } from '../constants/app';

export type { UserAction } from '../enums/tracking-events';

/** Query parameters worth keeping for acquisition reporting. */
const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

interface TrackData {
  productListingId?: string;
  searchQuery?: string;
  categoryId?: string;
  metadata?: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly identity = inject(VisitorIdentityService);
  private readonly location = inject(SelectedLocationService);

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  track(action: UserAction, data?: TrackData): void {
    // Always track for authenticated users
    // For anonymous users, only track key browsing actions
    if (!this.auth.isAuthenticated() && !ANONYMOUS_TRACKED_ACTIONS.has(action)) {
      return;
    }

    this.send(action, data);
  }

  /** Track events for all users (authenticated or not) — used for conversion funnels */
  trackAnonymous(action: UserAction, metadata?: Record<string, any>): void {
    this.send(action, { metadata });
  }

  /**
   * Records the first event of a visit, carrying the context every later event
   * inherits by sharing its session id.
   *
   * Device, referrer, campaign and location details are sent once here rather
   * than repeated on every event: they do not change mid-session, and attaching
   * twenty fields to each listing view would multiply the size of a collection
   * that already holds ninety days of history.
   *
   * Does nothing when the session id already exists, so it is safe to call from
   * anywhere that runs on startup.
   */
  startSession(): void {
    if (!this.isBrowser) return;
    if (!this.identity.startedNewSession()) return;

    this.send(TrackingEvent.SESSION_START, {
      metadata: {
        ...this.getDeviceInfo(),
        ...this.acquisitionContext(),
        landingPath: window.location.pathname,
        authenticated: this.auth.isAuthenticated(),
      },
    });
  }

  /** Collect client-side device/environment info for login events */
  getDeviceInfo(): Record<string, any> {
    if (!this.isBrowser) return {};

    const nav = navigator as any;
    const screen = window.screen;
    const info: Record<string, any> = {
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      language: navigator.language,
      languages: navigator.languages?.join(', '),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      platform: nav.userAgentData?.platform || navigator.platform || '',
      mobile: nav.userAgentData?.mobile ?? /Mobi|Android/i.test(navigator.userAgent),
      cookiesEnabled: navigator.cookieEnabled,
      online: navigator.onLine,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: nav.deviceMemory || null,
      connectionType: nav.connection?.effectiveType || null,
      ...this.selectedLocation(),
    };

    return info;
  }

  /** Get browser geolocation and fire a tracking call with it (async, best-effort) */
  trackLoginWithLocation(metadata: Record<string, any>): void {
    if (!this.auth.isAuthenticated()) return;

    if (this.isBrowser && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.send(TrackingEvent.LOGIN, {
            metadata: {
              ...metadata,
              geoLat: pos.coords.latitude,
              geoLng: pos.coords.longitude,
              geoAccuracy: pos.coords.accuracy,
            },
          });
        },
        () => {
          // Permission denied or error — track without geo
          this.send(TrackingEvent.LOGIN, { metadata });
        },
        { timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS },
      );
    } else {
      this.send(TrackingEvent.LOGIN, { metadata });
    }
  }

  /**
   * The one place an event reaches the API.
   *
   * Guards the browser check centrally: during server rendering there is no
   * visitor to attribute an event to, and the transfer cache does not cover
   * POSTs, so anything sent from the server would be recorded against the
   * server's own address and then counted a second time on the client.
   */
  private send(action: UserAction, data?: TrackData): void {
    if (!this.isBrowser) return;

    this.api
      .post(API.TRACK, {
        action,
        ...data,
        sessionId: this.identity.sessionId(),
        visitorId: this.identity.visitorId(),
      })
      .subscribe({
        error: () => {}, // silently fail — tracking should never block UX
      });
  }

  /**
   * Where this visit came from.
   *
   * A same-origin referrer is dropped because it describes an internal hop
   * rather than an acquisition source, and would otherwise make the site look
   * like its own biggest traffic channel.
   */
  private acquisitionContext(): Record<string, any> {
    const context: Record<string, any> = {};

    const referrer = document.referrer;
    if (referrer) {
      try {
        const url = new URL(referrer);
        if (url.host !== window.location.host) {
          context['referrer'] = referrer;
          context['referrerHost'] = url.host;
        }
      } catch {
        // Opaque referrer value; not worth recording.
      }
    }

    const params = new URLSearchParams(window.location.search);
    for (const key of CAMPAIGN_PARAMS) {
      const value = params.get(key);
      if (value) context[key] = value;
    }

    return context;
  }

  /**
   * The shopper's selected province/city/area, flattened to avoid
   * `[object Object]` in the metadata map.
   *
   * Read from `SelectedLocationService` rather than from storage directly, so the
   * persisted shape is known in exactly one place. The signals are empty until
   * something restores them, which on a deep link can happen after the first
   * event fires, hence the restore here.
   */
  private selectedLocation(): Record<string, string> {
    if (!this.location.province() && !this.location.city() && !this.location.area()) {
      this.location.restore();
    }

    const location: Record<string, string> = {};
    const province = this.location.province()?.name;
    const city = this.location.city()?.name;
    const area = this.location.area()?.name;
    if (province) location['locationProvince'] = province;
    if (city) location['locationCity'] = city;
    if (area) location['locationArea'] = area;
    return location;
  }
}
