import { Module } from '@nestjs/common';
import { ViewCounterService } from './view-counter.service.js';

/**
 * Holds the one definition of "a view".
 *
 * Its own module so listings and shorts can both depend on it without either
 * depending on the other, and so the rule cannot quietly diverge between them
 * again.
 */
@Module({
  providers: [ViewCounterService],
  exports: [ViewCounterService],
})
export class ViewCounterModule {}
