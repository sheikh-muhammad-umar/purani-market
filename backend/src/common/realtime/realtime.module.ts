import { Module } from '@nestjs/common';
import { RealtimeEventsService } from './realtime-events.service.js';

/**
 * Shared relay between event producers and the WebSocket gateway.
 *
 * Deliberately not global: importing it explicitly makes it visible which modules
 * push realtime events, which matters because the delivery is fire-and-forget and
 * therefore easy to forget about.
 */
@Module({
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
