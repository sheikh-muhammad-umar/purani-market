import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type UserActivityDocument = HydratedDocument<UserActivity>;

export enum UserAction {
  VIEW = 'view',
  SEARCH = 'search',
  FAVORITE = 'favorite',
  DISMISS = 'dismiss',
  CONTACT = 'contact',
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

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);

// Indexes
UserActivitySchema.index({ userId: 1, createdAt: -1 });
UserActivitySchema.index({ action: 1 });
UserActivitySchema.index({ userId: 1, action: 1 });
