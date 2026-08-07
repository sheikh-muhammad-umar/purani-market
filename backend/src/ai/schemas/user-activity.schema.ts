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

  @Prop({ type: String })
  sessionId?: string;

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

// Listing engagement (listing detail analytics)
UserActivitySchema.index({ productListingId: 1, action: 1 });

// Search analytics (top search terms aggregation)
UserActivitySchema.index(
  { searchQuery: 1, createdAt: -1 },
  { partialFilterExpression: { searchQuery: { $exists: true, $ne: null } } },
);

// Device/platform analytics (metadata.deviceType is frequently aggregated)
UserActivitySchema.index(
  { 'metadata.deviceType': 1, createdAt: -1 },
  { partialFilterExpression: { 'metadata.deviceType': { $exists: true } } },
);

// Session-based analytics
UserActivitySchema.index(
  { sessionId: 1, createdAt: -1 },
  { partialFilterExpression: { sessionId: { $exists: true, $ne: null } } },
);

// ── TTL Index ───────────────────────────────────────────────────
// Auto-expire activities older than 90 days to keep collection lean
// (analytics queries typically cover 30-90 day windows)
UserActivitySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
