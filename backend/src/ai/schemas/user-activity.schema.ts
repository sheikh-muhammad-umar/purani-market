import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { UserAction } from '../enums/user-action.enum.js';

export { UserAction } from '../enums/user-action.enum.js';

export type UserActivityDocument = HydratedDocument<UserActivity>;

@Schema({ timestamps: true, collection: 'user_activities' })
export class UserActivity {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: String, enum: UserAction, required: true })
  action!: UserAction;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  productListingId?: Types.ObjectId;

  /**
   * Which short the event was about.
   *
   * A first-class field rather than `metadata.shortId`, which is where the
   * short_* actions used to put it. Metadata is an unindexed Map, so counting a
   * single short's chat or call clicks meant scanning the whole collection —
   * cheap enough for an admin report run occasionally, far too expensive for
   * per-item numbers a seller loads on their own dashboard.
   */
  @Prop({ type: Types.ObjectId, ref: 'ShortVideo' })
  shortVideoId?: Types.ObjectId;

  @Prop({ type: String })
  searchQuery?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.Map,
    of: MongooseSchema.Types.Mixed,
    default: () => new Map(),
  })
  metadata!: Map<string, any>;

  @Prop({ type: String })
  ip?: string;

  @Prop({ type: String })
  userAgent?: string;

  /** Per-tab session id supplied by the client. Groups one visit together. */
  @Prop({ type: String })
  sessionId?: string;

  /**
   * Long-lived browser id supplied by the client.
   *
   * Survives across sessions, which is what makes guest journeys and returning
   * visitors measurable at all — `userId` is absent for most traffic, and
   * `sessionId` resets with every new tab.
   */
  @Prop({ type: String })
  visitorId?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);

// ── Query Indexes ───────────────────────────────────────────────
// User timeline (profile activity log, recommendations)
UserActivitySchema.index({ userId: 1, createdAt: -1 });

// Action + date range (analytics aggregations: engagement, funnels, breakdowns)
UserActivitySchema.index({ action: 1, createdAt: -1 });

// User + action (recommendation engine: user's views, favorites, contacts)
UserActivitySchema.index({ userId: 1, action: 1, createdAt: -1 });

// Listing engagement (listing detail analytics, seller engagement stats)
UserActivitySchema.index({ productListingId: 1, action: 1 });

// Short engagement (seller engagement stats). Partial, because only short_*
// events carry the field and a sparse-in-practice key should not index every row.
UserActivitySchema.index(
  { shortVideoId: 1, action: 1 },
  { partialFilterExpression: { shortVideoId: { $type: 'objectId' } } },
);

// Search analytics (top search terms aggregation)
//
// `$type: 'string'` rather than `{ $exists: true, $ne: null }`: MongoDB rejects
// `$ne` inside a partialFilterExpression, so the latter form fails to build and
// leaves the collection silently unindexed. Matching on the type excludes both
// missing and null values and is accepted.
UserActivitySchema.index(
  { searchQuery: 1, createdAt: -1 },
  { partialFilterExpression: { searchQuery: { $type: 'string' } } },
);

// Device/platform analytics (metadata.deviceType is frequently aggregated)
UserActivitySchema.index(
  { 'metadata.deviceType': 1, createdAt: -1 },
  { partialFilterExpression: { 'metadata.deviceType': { $exists: true } } },
);

// Session-based analytics
UserActivitySchema.index(
  { sessionId: 1, createdAt: -1 },
  { partialFilterExpression: { sessionId: { $type: 'string' } } },
);

// Guest journeys and returning-visitor analytics across sessions
UserActivitySchema.index(
  { visitorId: 1, createdAt: -1 },
  { partialFilterExpression: { visitorId: { $type: 'string' } } },
);

// ── TTL Index ───────────────────────────────────────────────────
/**
 * How long raw activity rows are kept.
 *
 * A year rather than a quarter, for two reasons. The retention report compares
 * the 30-60 day cohort against the last 30 days and groups monthly active users
 * by month, so a 90-day window leaves it with barely three points and no way to
 * see a seasonal cycle — which matters here, where Ramzan and Eid move the whole
 * market. And this is the value the collection has always actually used: the
 * declaration said 90 days while the live index said 365, and Mongoose cannot
 * alter an existing index's options, so the shorter figure was never in force.
 * Aligning the code to 365 keeps a year of real history; aligning the database to
 * 90 would have deleted most of it.
 *
 * Costs little: the collection and its indexes together sit in single-digit MB.
 * Revisit if per-day volume grows enough to make a year of rows expensive, at
 * which point pre-aggregated daily rollups are the answer rather than a shorter
 * window.
 */
const ACTIVITY_RETENTION_SECONDS = 365 * 24 * 60 * 60;

UserActivitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ACTIVITY_RETENTION_SECONDS },
);
