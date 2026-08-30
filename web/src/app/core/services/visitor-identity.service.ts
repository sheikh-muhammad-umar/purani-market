import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { STORAGE_SESSION_ID, STORAGE_VISITOR_ID } from '../constants/storage-keys';

/**
 * The two anonymous identifiers every analytics pipeline shares.
 *
 * Activity tracking, experiments and ad delivery each used to mint their own id,
 * which meant the three event streams could not be joined: there was no way to
 * ask whether the visitor who saw an ad went on to search, or whether an A/B
 * variant changed real behaviour. One source removes that.
 *
 * Neither id carries profile data. `visitorId` distinguishes a returning browser
 * from a new one; `sessionId` groups a single visit. Both are opaque UUIDs.
 */
@Injectable({ providedIn: 'root' })
export class VisitorIdentityService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Stable id for this browser, surviving tabs and restarts.
   *
   * Returns `undefined` on the server: there is no per-visitor storage during
   * server rendering, and inventing a value would make every prerendered request
   * look like the same visitor.
   */
  visitorId(): string | undefined {
    return this.readOrCreate(() => localStorage, STORAGE_VISITOR_ID);
  }

  /** Id for the current visit. Resets when the tab is closed. */
  sessionId(): string | undefined {
    return this.readOrCreate(() => sessionStorage, STORAGE_SESSION_ID);
  }

  /**
   * True when this call is the one that created the session id.
   *
   * Lets a caller emit a single `session_start` per visit without keeping its own
   * flag, and without racing other callers that also ask for the session id.
   */
  startedNewSession(): boolean {
    if (!this.isBrowser) return false;
    try {
      if (sessionStorage.getItem(STORAGE_SESSION_ID)) return false;
      return this.sessionId() !== undefined;
    } catch {
      return false;
    }
  }

  private readOrCreate(storage: () => Storage, key: string): string | undefined {
    if (!this.isBrowser) return undefined;
    try {
      const existing = storage().getItem(key);
      if (existing) return existing;
      const generated = this.generateId();
      storage().setItem(key, generated);
      return generated;
    } catch {
      // Private browsing with storage blocked. Events still reach the server and
      // are simply counted without session grouping, which is better than
      // throwing inside a tracking call.
      return undefined;
    }
  }

  private generateId(): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
