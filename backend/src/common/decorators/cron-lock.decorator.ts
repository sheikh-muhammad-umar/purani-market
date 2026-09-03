import { Logger } from '@nestjs/common';
import {
  CronLockService,
  DEFAULT_CRON_LOCK_TTL_MS,
} from '../services/cron-lock.service.js';

const logger = new Logger('CronLock');

export interface CronLockOptions {
  /**
   * Explicit lock key. Defaults to `ClassName.methodName`, which is unique per
   * job and stable across restarts. Override only if two methods must share a
   * lock (rare).
   */
  key?: string;

  /**
   * How long the lock is held before it may be seized by another instance.
   * Set this above the job's worst-case runtime so a slow run is never
   * interrupted by a peer. Defaults to 10 minutes.
   */
  ttlMs?: number;
}

/**
 * Makes a scheduled method run once cluster-wide.
 *
 * Place it directly beneath `@Cron(...)`. When the scheduler fires on every
 * instance, only the one that wins the shared lock executes the body; the rest
 * return early. Non-winning instances resolve to `undefined`, matching the
 * "nothing to do" return the jobs already use.
 *
 * If the lock service is not yet available (very early startup) the job runs
 * unlocked rather than being dropped — no worse than a single-instance deploy.
 *
 *   @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: CRON_TIMEZONE })
 *   @CronLock()
 *   async handleExpiredListings(): Promise<number> { ... }
 */
export function CronLock(options: CronLockOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;
    const className = target.constructor?.name ?? 'Unknown';
    const jobKey = options.key ?? `${className}.${String(propertyKey)}`;
    const ttlMs = options.ttlMs ?? DEFAULT_CRON_LOCK_TTL_MS;

    descriptor.value = async function wrapped(
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const lockService = CronLockService.getInstance();

      // No coordinator yet — behave like a single instance rather than skip work.
      if (!lockService) {
        logger.warn(
          `Cron lock service unavailable; running "${jobKey}" without a lock`,
        );
        return original.apply(this, args);
      }

      return lockService.runExclusive(
        jobKey,
        () => original.apply(this, args),
        ttlMs,
      );
    };

    return descriptor;
  };
}
