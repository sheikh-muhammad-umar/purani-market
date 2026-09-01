import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, catchError, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { VisitorIdentityService } from './visitor-identity.service';
import { API } from '../constants/api-endpoints';
import {
  AdCampaign,
  AdCampaignPayload,
  AdCreative,
  AdCreativePayload,
  AdDevice,
  AdEventType,
  AdPerformanceReport,
  AdPlacement,
  AdServeContext,
  Advertiser,
  AdvertiserPayload,
  ServedAd,
} from '../models/advertising.model';

/** Viewport width at or below which a visitor counts as mobile for targeting. */
const MOBILE_BREAKPOINT = 768;

@Injectable({ providedIn: 'root' })
export class AdvertisingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly identity = inject(VisitorIdentityService);

  constructor(private readonly api: ApiService) {}

  // ── Public delivery ───────────────────────────────────────────────

  /**
   * Fetches the ads for a slot.
   *
   * Failures resolve to an empty list rather than propagating: an ad is
   * supplementary content, and a delivery problem must never break the page it
   * sits on or surface an error to a shopper.
   */
  serve(placement: AdPlacement, context: AdServeContext = {}): Observable<ServedAd[]> {
    const params: Record<string, string | number> = { placement };
    if (context.categoryId) params['categoryId'] = context.categoryId;
    if (context.provinceId) params['provinceId'] = context.provinceId;
    if (context.cityId) params['cityId'] = context.cityId;
    if (context.limit) params['limit'] = context.limit;

    const device = this.currentDevice();
    if (device) params['device'] = device;

    const sessionId = this.sessionId();
    if (sessionId) params['sessionId'] = sessionId;

    return this.api.get<{ ads: ServedAd[] }>(API.ADS_SERVE, params).pipe(
      map((response) => response?.ads ?? []),
      catchError(() => of([])),
    );
  }

  /**
   * Reports an impression or click.
   *
   * Errors are swallowed for the same reason as `serve`: bookkeeping must not
   * interrupt what the visitor is doing, and the click navigation has already
   * been allowed to proceed.
   */
  recordEvent(creativeId: string, type: AdEventType, placement: AdPlacement): Observable<void> {
    return this.api
      .post<unknown>(API.ADS_EVENT(creativeId), {
        type,
        placement,
        sessionId: this.sessionId(),
      })
      .pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      );
  }

  /**
   * Stable anonymous id for this browser session.
   *
   * Only used so the API can collapse repeat impressions of the same creative;
   * it holds no profile data and is deliberately per-session rather than
   * persistent. Shared with activity tracking so ad exposure and subsequent
   * behaviour can be joined on one id.
   */
  sessionId(): string | undefined {
    return this.identity.sessionId();
  }

  private currentDevice(): AdDevice | undefined {
    if (!this.isBrowser) return undefined;
    return window.innerWidth <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
  }

  // ── Admin: advertisers ────────────────────────────────────────────

  listAdvertisers(search?: string, limit?: number): Observable<Advertiser[]> {
    const params: Record<string, string | number> = {};
    if (search?.trim()) params['search'] = search.trim();
    if (limit !== undefined) params['limit'] = limit;
    return this.api.get<Advertiser[]>(
      API.ADS_ADMIN_ADVERTISERS,
      Object.keys(params).length > 0 ? params : undefined,
    );
  }

  getAdvertiser(id: string): Observable<Advertiser> {
    return this.api.get<Advertiser>(API.ADS_ADMIN_ADVERTISER(id));
  }

  createAdvertiser(payload: AdvertiserPayload): Observable<Advertiser> {
    return this.api.post<Advertiser>(API.ADS_ADMIN_ADVERTISERS, payload);
  }

  updateAdvertiser(id: string, payload: Partial<AdvertiserPayload>): Observable<Advertiser> {
    return this.api.patch<Advertiser>(API.ADS_ADMIN_ADVERTISER(id), payload);
  }

  deleteAdvertiser(id: string): Observable<void> {
    return this.api.delete<void>(API.ADS_ADMIN_ADVERTISER(id));
  }

  // ── Admin: campaigns ──────────────────────────────────────────────

  listCampaigns(
    filters: {
      advertiserId?: string;
      status?: string;
      placement?: string;
    } = {},
  ): Observable<AdCampaign[]> {
    const params: Record<string, string> = {};
    if (filters.advertiserId) params['advertiserId'] = filters.advertiserId;
    if (filters.status) params['status'] = filters.status;
    if (filters.placement) params['placement'] = filters.placement;
    return this.api.get<AdCampaign[]>(API.ADS_ADMIN_CAMPAIGNS, params);
  }

  getCampaign(id: string): Observable<AdCampaign> {
    return this.api.get<AdCampaign>(API.ADS_ADMIN_CAMPAIGN(id));
  }

  createCampaign(payload: AdCampaignPayload): Observable<AdCampaign> {
    return this.api.post<AdCampaign>(API.ADS_ADMIN_CAMPAIGNS, payload);
  }

  updateCampaign(id: string, payload: Partial<AdCampaignPayload>): Observable<AdCampaign> {
    return this.api.patch<AdCampaign>(API.ADS_ADMIN_CAMPAIGN(id), payload);
  }

  deleteCampaign(id: string): Observable<void> {
    return this.api.delete<void>(API.ADS_ADMIN_CAMPAIGN(id));
  }

  // ── Admin: creatives ──────────────────────────────────────────────

  listCreatives(campaignId: string): Observable<AdCreative[]> {
    return this.api.get<AdCreative[]>(API.ADS_ADMIN_CAMPAIGN_CREATIVES(campaignId));
  }

  createCreative(payload: AdCreativePayload): Observable<AdCreative> {
    return this.api.post<AdCreative>(API.ADS_ADMIN_CREATIVES, payload);
  }

  updateCreative(id: string, payload: Partial<AdCreativePayload>): Observable<AdCreative> {
    return this.api.patch<AdCreative>(API.ADS_ADMIN_CREATIVE(id), payload);
  }

  deleteCreative(id: string): Observable<void> {
    return this.api.delete<void>(API.ADS_ADMIN_CREATIVE(id));
  }

  // ── Admin: reporting ──────────────────────────────────────────────

  getPerformance(from?: string, to?: string): Observable<AdPerformanceReport> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.api.get<AdPerformanceReport>(API.ADS_ADMIN_PERFORMANCE, params);
  }

  syncCampaignStatuses(): Observable<{ activated: number; completed: number }> {
    return this.api.post<{ activated: number; completed: number }>(API.ADS_ADMIN_SYNC_STATUSES, {});
  }
}
