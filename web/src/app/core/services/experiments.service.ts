import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { VisitorIdentityService } from './visitor-identity.service';
import { API } from '../constants/api-endpoints';

export interface VariantAssignment {
  experimentKey: string;
  variantId: string;
  config: Record<string, any>;
}

export enum ExperimentEventType {
  SEARCH_IMPRESSION = 'search_impression',
  SEARCH_CLICK = 'search_click',
  SEARCH_CONTACT = 'search_contact',
  SEARCH_FAVORITE = 'search_favorite',
  CONVERSION = 'conversion',
}

export interface TrackEventPayload {
  experimentKey: string;
  variantId: string;
  eventType: ExperimentEventType;
  searchQuery?: string;
  listingId?: string;
  position?: number;
  totalResults?: number;
  metadata?: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class ExperimentsService {
  private readonly identity = inject(VisitorIdentityService);
  private assignmentsCache$: Observable<VariantAssignment[]> | null = null;
  private assignmentsMap = new Map<string, VariantAssignment>();

  constructor(private readonly api: ApiService) {}

  /**
   * Get all experiment assignments for the current user/visitor.
   * Cached for the session — assignments don't change mid-session.
   */
  getAssignments(): Observable<VariantAssignment[]> {
    if (!this.assignmentsCache$) {
      const visitorId = this.getVisitorId();
      this.assignmentsCache$ = this.api
        .get<VariantAssignment[]>(API.EXPERIMENTS_ASSIGNMENTS, { visitorId })
        .pipe(
          tap((assignments) => {
            this.assignmentsMap.clear();
            for (const a of assignments) {
              this.assignmentsMap.set(a.experimentKey, a);
            }
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.assignmentsCache$;
  }

  /**
   * Get the variant for a specific experiment (synchronous, from cache).
   * Returns null if assignments haven't loaded yet.
   */
  getVariant(experimentKey: string): VariantAssignment | null {
    return this.assignmentsMap.get(experimentKey) ?? null;
  }

  /**
   * Get all cached assignments (synchronous).
   * Returns empty array if assignments haven't loaded yet.
   */
  getAllAssignments(): VariantAssignment[] {
    return Array.from(this.assignmentsMap.values());
  }

  /**
   * Track an experiment event (fire-and-forget).
   */
  track(payload: TrackEventPayload): void {
    const visitorId = this.getVisitorId();
    this.api.post(API.EXPERIMENTS_TRACK, { ...payload, visitorId }).subscribe({ error: () => {} }); // Fire and forget
  }

  /**
   * Track an event for ALL running experiments (fire-and-forget).
   * Use this when the event applies to every active experiment (e.g. search impressions/clicks).
   */
  trackAll(
    eventType: ExperimentEventType,
    data?: Omit<TrackEventPayload, 'experimentKey' | 'variantId' | 'eventType'>,
  ): void {
    for (const assignment of this.getAllAssignments()) {
      this.track({
        experimentKey: assignment.experimentKey,
        variantId: assignment.variantId,
        eventType,
        ...data,
      });
    }
  }

  /**
   * Get or create a persistent visitor ID for anonymous users.
   *
   * Shared with activity tracking and ad delivery, so an experiment result can
   * be joined to what the visitor actually did. `'ssr'` is kept as the
   * server-side value because assignments are requested during server rendering
   * and the endpoint requires a non-empty id.
   */
  private getVisitorId(): string {
    return this.identity.visitorId() ?? 'ssr';
  }
}
