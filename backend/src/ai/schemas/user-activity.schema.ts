import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type UserActivityDocument = HydratedDocument<UserActivity>;

export enum UserAction {
  // Browsing
  VIEW = 'view',
  SEARCH = 'search',
  CATEGORY_BROWSE = 'category_browse',
  PAGE_VIEW = 'page_view',

  // Engagement
  FAVORITE = 'favorite',
  UNFAVORITE = 'unfavorite',
  CONTACT = 'contact',
  SHARE = 'share',

  // Listing actions
  LISTING_CREATE = 'listing_create',
  LISTING_EDIT = 'listing_edit',
  LISTING_DELETE = 'listing_delete',
  LISTING_STATUS_CHANGE = 'listing_status_change',
  LISTING_FEATURE = 'listing_feature',

  // Auth
  LOGIN = 'login',
  REGISTER = 'register',
  LOGOUT = 'logout',

  // Messaging
  MESSAGE_SENT = 'message_sent',
  CONVERSATION_START = 'conversation_start',

  // Payments
  PACKAGE_PURCHASE = 'package_purchase',
  PAYMENT_ATTEMPT = 'payment_attempt',

  // Location
  LOCATION_CHANGE = 'location_change',

  // AI
  DISMISS = 'dismiss',
  RECOMMENDATION_CLICK = 'recommendation_click',
}

@Schema({ timestamps: true, collection: 'user_activities' })
export class UserActivity {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: UserAction, required: true })
  action!: UserAction;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  productListingId?: Types.ObjectId;

  @Prop({ type: String })
  searchQuery?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Map, of: MongooseSchema.Types.Mixed, default: () => new Map() })
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

// Indexes
UserActivitySchema.index({ userId: 1, createdAt: -1 });
UserActivitySchema.index({ action: 1 });
UserActivitySchema.index({ userId: 1, action: 1 });
UserActivitySchema.index({ productListingId: 1, action: 1 });
UserActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // TTL: 1 year
