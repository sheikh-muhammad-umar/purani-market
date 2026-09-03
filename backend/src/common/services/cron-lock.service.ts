import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Model } from 'mongoose';
import { CronLock, CronLockDocument } from '../schemas/cron-lock.schema.js';

/** Default lifetime of a held lock. A job that outruns this can be seized by
 * another instance, so it is deliberately generous relative to job runtimes. */
export const DEFAULT_CRON_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Cluster-wide mutex for scheduled jobs, backed by a single Mongo collection.
 *
 * Acquisition is one atomic `findOneAndUpdate` upsert keyed on the job name:
 * an instance wins only if no live lock exists (or the existing one has
 * expired). Everyone else either matches nothing or hits a duplicate-key
 * error, and skips the run. A TTL index on `expiresAt` clears locks orphaned
 * by a crashed holder, so a job can never wedge permanently.
 *
 * Requires no Redis or external coordinator — it reuses the database the app
 * already depends on, which is why it is "lightweight".
 */
@Injectable()
export class CronLockService implements OnModuleInit {
  private readonly logger = new Logger(CronLockService.name);

  /**
   * Identifies this process across the cluster. Combines the hostname (useful
   * in logs) with a random suffix so two instances on the same host never
   * collide.
   */
  private readonly instanceId = `${hostname()}:${process.pid}:${randomUUID()}`;

  /**
   * The scheduler invokes `@Cron` methods, and a method decorator cannot inject
   * dependencies. So the wrapper reads this singleton reference, populated once
   * the module is initialised. Until then, jobs run unlocked rather than crash
   * — the same behaviour as a single-instance deployment.
   */
  private static instance: CronLockService | null = null;

  constructor(
    @InjectModel(CronLock.name)
    private readonly lockModel: Model<CronLockDocument>,
  ) {}

  onModuleInit(): void {
    CronLockService.instance = this;
  }

  static getInstance(): CronLockService | null {
    return CronLockService.instance;
  }

  /**
   * Try to take the named lock. Returns true if this instance now owns it.
   *
   * The filter matches when the lock is absent or expired; the upsert then
   * writes our ownership. A concurrent winner leaves the other callers with
   * either no matched document or a duplicate-key error — both mean "someone
   * else has it", so both return false.
   */
  async acquire(
    jobKey: string,
    ttlMs = DEFAULT_CRON_LOCK_TTL_MS,
  ): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    try {
      await this.lockModel
        .findOneAndUpdate(
          { _id: jobKey, expiresAt: { $lte: now } },
          {
            $set: { owner: this.instanceId, lockedAt: now, expiresAt },
            $setOnInsert: { _id: jobKey },
          },
          { upsert: true, new: true },
        )
        .exec();
      return true;
    } catch (err: unknown) {
      if (this.isDuplicateKeyError(err)) {
        // A live lock already exists and hasn't expired — another instance owns
        // this run. Expected under contention, so not logged as an error.
        return false;
      }
      // Anything else (e.g. Mongo unreachable) — don't run, and surface why.
      this.logger.error(
        `Failed to acquire cron lock "${jobKey}": ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Release a lock this instance holds. Scoped to `owner` so a run that
   * overran its TTL — and whose lock was legitimately seized by another
   * instance — cannot delete the new holder's lock.
   */
  async release(jobKey: string): Promise<void> {
    try {
      await this.lockModel
        .deleteOne({ _id: jobKey, owner: this.instanceId })
        .exec();
    } catch (err) {
      this.logger.warn(
        `Failed to release cron lock "${jobKey}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Run `fn` only if this instance wins the lock, always releasing afterwards.
   * Returns the function's result, or `undefined` when the lock was not won.
   */
  async runExclusive<T>(
    jobKey: string,
    fn: () => Promise<T>,
    ttlMs = DEFAULT_CRON_LOCK_TTL_MS,
  ): Promise<T | undefined> {
    const acquired = await this.acquire(jobKey, ttlMs);
    if (!acquired) {
      this.logger.debug(`Skipping "${jobKey}" — lock held by another instance`);
      return undefined;
    }

    try {
      return await fn();
    } finally {
      await this.release(jobKey);
    }
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 11000
    );
  }
}
