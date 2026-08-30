import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** One push addressed at a single user's open sockets. */
export interface UserRealtimeEvent {
  userId: string;
  event: string;
  payload: unknown;
}

/**
 * One-way relay from any module to the WebSocket gateway.
 *
 * The gateway lives in the messaging module, and notifications must not depend on
 * messaging — that direction is backwards and produces a circular import as soon
 * as messaging wants to raise a notification. Publishing here instead keeps both
 * sides pointing at `common`: producers know nothing about sockets, and the
 * gateway knows nothing about who is producing.
 *
 * Fire-and-forget by design. If nobody is subscribed, or the recipient has no
 * open socket, the event is simply dropped: every consumer of a realtime hint
 * must also work without it, because a client can always be offline or
 * reconnecting.
 */
@Injectable()
export class RealtimeEventsService {
  private readonly events = new Subject<UserRealtimeEvent>();

  /** Consumed by the gateway, which is the only thing that owns sockets. */
  readonly events$: Observable<UserRealtimeEvent> = this.events.asObservable();

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!userId) return;
    this.events.next({ userId, event, payload });
  }
}
