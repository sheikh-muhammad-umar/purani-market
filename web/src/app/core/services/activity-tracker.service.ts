import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from '../auth/auth.service';

export type UserAction =
  | 'view'
  | 'search'
  | 'category_browse'
  | 'page_view'
  | 'favorite'
  | 'unfavorite'
  | 'contact'
  | 'share'
  | 'listing_create'
  | 'listing_edit'
  | 'listing_delete'
  | 'listing_status_change'
  | 'listing_feature'
  | 'login'
  | 'register'
  | 'logout'
  | 'message_sent'
  | 'conversation_start'
  | 'package_purchase'
  | 'payment_attempt'
  | 'location_change'
  | 'dismiss'
  | 'recommendation_click';

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
    // Only track for authenticated users
    if (!this.auth.isAuthenticated()) return;

    this.api.post('/track', { action, ...data }).subscribe({
      error: () => {}, // silently fail — tracking should never block UX
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
      const stored = localStorage.getItem('selected_location');
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
            .post('/track', {
              action: 'login' as UserAction,
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
            .post('/track', { action: 'login' as UserAction, metadata })
            .subscribe({ error: () => {} });
        },
        { timeout: 5000, maximumAge: 300000 },
      );
    } else {
      this.api
        .post('/track', { action: 'login' as UserAction, metadata })
        .subscribe({ error: () => {} });
    }
  }
}
