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

  // Admin actions
  ADMIN_USER_STATUS_CHANGE = 'admin_user_status_change',
  ADMIN_USER_ROLE_CHANGE = 'admin_user_role_change',
  ADMIN_USER_AD_LIMIT_CHANGE = 'admin_user_ad_limit_change',
  ADMIN_LISTING_APPROVE = 'admin_listing_approve',
  ADMIN_LISTING_REJECT = 'admin_listing_reject',
  ADMIN_CATEGORY_CREATE = 'admin_category_create',
  ADMIN_CATEGORY_UPDATE = 'admin_category_update',
  ADMIN_CATEGORY_DELETE = 'admin_category_delete',
  ADMIN_CATEGORY_ATTRIBUTES_UPDATE = 'admin_category_attributes_update',
  ADMIN_CATEGORY_FEATURES_UPDATE = 'admin_category_features_update',
  ADMIN_LOCATION_CREATE = 'admin_location_create',
  ADMIN_LOCATION_UPDATE = 'admin_location_update',
  ADMIN_LOCATION_DELETE = 'admin_location_delete',
  ADMIN_PACKAGE_CREATE = 'admin_package_create',
  ADMIN_PACKAGE_UPDATE = 'admin_package_update',
  ADMIN_EXPORT_REPORT = 'admin_export_report',
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
