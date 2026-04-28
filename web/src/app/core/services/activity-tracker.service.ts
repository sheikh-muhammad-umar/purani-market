import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from '../auth/auth.service';
import { UserAction, ANONYMOUS_TRACKED_ACTIONS, TrackingEvent } from '../enums/tracking-events';
import { STORAGE_SELECTED_LOCATION } from '../constants/storage-keys';
import { API } from '../constants/api-endpoints';
import { GEO_TIMEOUT_MS, GEO_MAX_AGE_MS } from '../constants/app';

export type { UserAction } from '../enums/tracking-events';

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService {
  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  track(
    action: UserAction,
    data?: {
      productListingId?: string;
      searchQuery?: string;
      categoryId?: string;
      metadata?: Record<string, any>;
    },
  ): void {
    // Always track for authenticated users
    // For anonymous users, only track key browsing actions
    if (!this.auth.isAuthenticated() && !ANONYMOUS_TRACKED_ACTIONS.has(action)) {
      return;
    }

    this.api.post(API.TRACK, { action, ...data }).subscribe({
      error: () => {}, // silently fail — tracking should never block UX
    });
  }

  /** Track events for all users (authenticated or not) — used for conversion funnels */
  trackAnonymous(action: UserAction, metadata?: Record<string, any>): void {
    this.api.post(API.TRACK, { action, metadata }).subscribe({
      error: () => {},
    });
  }

  /** Collect client-side device/environment info for login events */
  getDeviceInfo(): Record<string, any> {
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
    };

    // Selected location from localStorage (flattened to avoid [object Object])
    try {
      const stored = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.province?.name) info['locationProvince'] = parsed.province.name;
        if (parsed.city?.name) info['locationCity'] = parsed.city.name;
        if (parsed.area?.name) info['locationArea'] = parsed.area.name;
      }
    } catch {
      /* ignore */
    }

    return info;
  }

  /** Get browser geolocation and fire a tracking call with it (async, best-effort) */
  trackLoginWithLocation(metadata: Record<string, any>): void {
    if (!this.auth.isAuthenticated()) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.api
            .post(API.TRACK, {
              action: TrackingEvent.LOGIN as UserAction,
              metadata: {
                ...metadata,
                geoLat: pos.coords.latitude,
                geoLng: pos.coords.longitude,
                geoAccuracy: pos.coords.accuracy,
              },
            })
            .subscribe({ error: () => {} });
        },
        () => {
          // Permission denied or error — track without geo
          this.api
            .post(API.TRACK, { action: TrackingEvent.LOGIN as UserAction, metadata })
            .subscribe({ error: () => {} });
        },
        { timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS },
      );
    } else {
      this.api
        .post(API.TRACK, { action: TrackingEvent.LOGIN as UserAction, metadata })
        .subscribe({ error: () => {} });
    }
  }
}
