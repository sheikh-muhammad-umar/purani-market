import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import {
  VIEW_DEDUP_PREFIX,
  VIEW_DEDUP_WINDOW_SECONDS,
} from '../common/constants/app.constants.js';
import { clientContext } from '../common/utils/request-context.js';

/** What kind of thing was viewed. Keeps the two key spaces apart. */
export type ViewableKind = 'listing' | 'short';

/** Who is looking: either an account or an anonymous fingerprint. */
export interface Viewer {
  userId?: string;
  req?: unknown;
}

/**
 * Decides whether a view should be counted.
 *
 * One visitor can add one view per item per hour. Coming back later counts —
 * repeat interest is a real signal a seller should see — but reloading the page
 * does not.
 *
 * Shared by listings and shorts so the number means the same thing on both
 * screens. It did not before: listings de-duplicated per visitor for half an
 * hour, while shorts counted every single request, including the seller
 * reloading their own video. A seller comparing a listing's views with a short's
 * was comparing two different measures.
 */
@Injectable()
export class ViewCounterService {
  private readonly logger = new Logger(ViewCounterService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async shouldCountView(
    kind: ViewableKind,
    itemId: string,
    viewer: Viewer,
  ): Promise<boolean> {
    const key = `${VIEW_DEDUP_PREFIX}:${kind}:${itemId}:${this.visitorId(viewer)}`;

    try {
      // NX so only the first view in the window sets the key; EX expires it, which
      // is what lets the next hour count again.
      const isFirstInWindow = await this.redis.set(
        key,
        '1',
        'EX',
        VIEW_DEDUP_WINDOW_SECONDS,
        'NX',
      );
      return !!isFirstInWindow;
    } catch (err) {
      // Not counted rather than counted. Without Redis there is no way to tell a
      // fresh view from the twentieth reload, and a view count that overstates
      // itself is worse than one that misses a few.
      this.logger.warn(
        `View accounting unavailable for ${kind} ${itemId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Stable id for the viewer.
   *
   * Signed-in users are themselves; everyone else is a hash of address and
   * user-agent. Imperfect — a different browser looks like a different person —
   * but it is the identity the rest of the analytics already uses.
   */
  private visitorId(viewer: Viewer): string {
    if (viewer.userId) return `u:${viewer.userId}`;

    const { ip = 'unknown', userAgent = 'unknown' } = clientContext(viewer.req);
    const hash = createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .slice(0, 16);
    return `a:${hash}`;
  }
}
