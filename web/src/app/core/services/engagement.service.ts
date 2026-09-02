import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';

/** How one listing or short is performing. Owner-visible only. */
export interface ItemEngagement {
  itemId: string;
  views: number;
  likes: number;
  /** Buyers who opened a chat — one per buyer, not per message. */
  chats: number;
  calls: number;
  whatsapp: number;
  /**
   * Distinct people who tried to make contact, by any route.
   *
   * Not the sum of the other columns: one person who taps call twice and then
   * messages is a single lead.
   */
  leads: number;
}

/**
 * Engagement figures for the signed-in seller's own listings and shorts.
 *
 * Fetched as a whole set and looked up by id, because the listings screen shows
 * up to fifty rows at once and a request per row would be fifty round trips.
 */
@Injectable({ providedIn: 'root' })
export class EngagementService {
  constructor(private readonly api: ApiService) {}

  getListingEngagement(): Observable<Map<string, ItemEngagement>> {
    return this.api
      .get<ItemEngagement[]>(API.ENGAGEMENT_LISTINGS)
      .pipe(map((rows) => this.byId(rows)));
  }

  getShortsEngagement(): Observable<Map<string, ItemEngagement>> {
    return this.api
      .get<ItemEngagement[]>(API.ENGAGEMENT_SHORTS)
      .pipe(map((rows) => this.byId(rows)));
  }

  /** Keyed for O(1) lookup while rendering a row. */
  private byId(rows: ItemEngagement[]): Map<string, ItemEngagement> {
    return new Map((rows ?? []).map((row) => [row.itemId, row]));
  }
}

/** Zeroes, for an item with no engagement recorded yet. */
export const EMPTY_ENGAGEMENT: Omit<ItemEngagement, 'itemId'> = {
  views: 0,
  likes: 0,
  chats: 0,
  calls: 0,
  whatsapp: 0,
  leads: 0,
};
