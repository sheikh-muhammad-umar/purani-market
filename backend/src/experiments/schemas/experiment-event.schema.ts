import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExperimentEventDocument = HydratedDocument<ExperimentEvent>;

export enum ExperimentEventType {
  /** Search results were shown to the user */
  SEARCH_IMPRESSION = 'search_impression',
  /** User clicked a search result */
  SEARCH_CLICK = 'search_click',
  /** User contacted the seller from a search result */
  SEARCH_CONTACT = 'search_contact',
  /** User favorited a listing from search results */
  SEARCH_FAVORITE = 'search_favorite',
  /** Generic conversion (purchase, lead, etc.) */
  CONVERSION = 'conversion',
}

@Schema({ timestamps: true, collection: 'experiment_events' })
export class ExperimentEvent {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  experimentKey!: string;

  @Prop({ type: String, required: true })
  variantId!: string;

  @Prop({ type: String, enum: ExperimentEventType, required: true })
  eventType!: ExperimentEventType;

  /** User ID (authenticated) or session/visitor ID (anonymous) */
  @Prop({ type: String, required: true, index: true })
  subjectId!: string;

  /** Search query that produced the results */
  @Prop({ type: String })
  searchQuery?: string;

  /** Listing that was clicked/favorited/contacted */
  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  listingId?: Types.ObjectId;

  /** Position in the search results (0-indexed) */
  @Prop({ type: Number })
  position?: number;

  /** Total results shown */
  @Prop({ type: Number })
  totalResults?: number;

  /** Additional metadata */
  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt!: Date;
}

export const ExperimentEventSchema =
  SchemaFactory.createForClass(ExperimentEvent);

// Indexes for analytics queries
ExperimentEventSchema.index({ experimentKey: 1, variantId: 1, eventType: 1 });
ExperimentEventSchema.index({ experimentKey: 1, createdAt: -1 });
ExperimentEventSchema.index({ subjectId: 1, experimentKey: 1 });
// TTL: auto-delete events older than 6 months
ExperimentEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);
