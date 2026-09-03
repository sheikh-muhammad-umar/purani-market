import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CronLockDocument = HydratedDocument<CronLock>;

/**
 * A single row per scheduled job, used as a cluster-wide mutex.
 *
 * Every backend instance registers the same `@Cron` handlers, so without a
 * shared lock each job fires on every instance at once — double-sending
 * reminders, double-processing expiries, and racing on the same rows. This
 * collection lets exactly one instance own a job for the duration of a run.
 *
 * `_id` is the job key (e.g. the service/method name), so acquisition is a
 * single atomic upsert on the primary key rather than a query-then-write.
 */
@Schema({ collection: 'cron_locks', timestamps: false, _id: false })
export class CronLock {
  /** The job key — service+method, e.g. `ListingLifecycleService.handleExpiredListings`. */
  @Prop({ type: String, required: true })
  _id!: string;

  /** Identifies the process that currently holds the lock, so only the owner releases it. */
  @Prop({ type: String, required: true })
  owner!: string;

  /** When the lock was taken — for observability only. */
  @Prop({ type: Date, required: true })
  lockedAt!: Date;

  /**
   * When the lock is considered stale and may be seized by another instance.
   * Also drives the TTL index, so a lock left behind by a crashed holder is
   * removed automatically rather than blocking the job forever.
   */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export const CronLockSchema = SchemaFactory.createForClass(CronLock);

// TTL index: Mongo reaps a lock once `expiresAt` passes. `expireAfterSeconds: 0`
// means "expire at the exact time in the field", giving crash recovery for free.
CronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
