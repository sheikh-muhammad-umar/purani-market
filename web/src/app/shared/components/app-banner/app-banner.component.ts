import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { environment } from '../../../../environments/environment';
import {
  STORAGE_APP_BANNER_DISMISSED,
  STORAGE_APP_BANNER_SHOWN,
} from '../../../core/constants/storage-keys';
import {
  UA_MOBILE_PATTERN,
  UA_HUAWEI_PATTERN,
  UA_IOS_PATTERN,
  PLATFORM_IOS,
  PLATFORM_ANDROID,
  PLATFORM_HUAWEI,
} from '../../../core/constants/app';

@Component({
  selector: 'app-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div class="app-banner">
        <button class="banner-close" (click)="dismiss()" aria-label="Close banner">
          <span class="material-symbols-rounded">close</span>
        </button>
        <div class="banner-icon">
          <span class="banner-logo">M</span>
        </div>
        <div class="banner-text">
          <span class="banner-title">Get the Marketplace App</span>
          <span class="banner-subtitle">Faster, smoother, better experience</span>
        </div>
        <div class="banner-links">
          <a
            [href]="storeLink"
            target="_blank"
            rel="noopener"
            class="banner-btn"
            (click)="onStoreClick()"
            >Open</a
          >
        </div>
      </div>
    }
  `,
  styles: [
    `
      .app-banner {
        display: none;
      }

      @media (max-width: 767px) {
        .app-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }

        .banner-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          display: flex;
          flex-shrink: 0;
          .material-symbols-rounded {
            font-size: 18px;
          }
        }

        .banner-icon {
          flex-shrink: 0;
        }

        .banner-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--primary);
          color: #fff;
          font-weight: 800;
          font-size: 16px;
        }

        .banner-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .banner-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .banner-subtitle {
          font-size: 11px;
          color: var(--text-muted);
        }

        .banner-links {
          flex-shrink: 0;
        }

        .banner-btn {
          display: inline-flex;
          padding: 6px 16px;
          background: var(--primary);
          color: #fff;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          font-family: inherit;
        }
      }
    `,
  ],
})
export class AppBannerComponent {
  readonly visible = signal(false);

  private readonly tracker = inject(ActivityTrackerService);

  storeLink = '';
  platform = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_APP_BANNER_DISMISSED);
      if (
        dismissed &&
        Date.now() - Number(dismissed) < environment.appBannerDismissDays * 86400000
      ) {
        return;
      }

      const ua = navigator.userAgent.toLowerCase();
      const isMobile = UA_MOBILE_PATTERN.test(ua);

      if (isMobile) {
        this.platform = this.detectPlatform(ua);
        this.storeLink = this.getStoreLink(this.platform);
        this.visible.set(true);

        // Track impression once per session
        if (!sessionStorage.getItem(STORAGE_APP_BANNER_SHOWN)) {
          sessionStorage.setItem(STORAGE_APP_BANNER_SHOWN, '1');
          this.tracker.trackAnonymous(TrackingEvent.APP_BANNER_SHOWN, { platform: this.platform });
        }
      }
    }
  }

  onStoreClick(): void {
    this.tracker.trackAnonymous(TrackingEvent.APP_BANNER_CLICK, {
      platform: this.platform,
      store: this.storeLink,
    });
  }

  dismiss(): void {
    this.visible.set(false);
    localStorage.setItem(STORAGE_APP_BANNER_DISMISSED, String(Date.now()));
    this.tracker.trackAnonymous(TrackingEvent.APP_BANNER_DISMISS, { platform: this.platform });
  }

  private detectPlatform(ua: string): string {
    if (UA_HUAWEI_PATTERN.test(ua)) return PLATFORM_HUAWEI;
    if (UA_IOS_PATTERN.test(ua)) return PLATFORM_IOS;
    return PLATFORM_ANDROID;
  }

  private getStoreLink(platform: string): string {
    if (platform === PLATFORM_HUAWEI) return environment.appGalleryUrl;
    if (platform === PLATFORM_IOS) return environment.appStoreUrl;
    return environment.playStoreUrl;
  }
}
