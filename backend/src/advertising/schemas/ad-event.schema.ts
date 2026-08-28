import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdEventType, AdPlacement } from '../advertising.enums.js';

export type AdEventDocument = HydratedDocument<AdEvent>;

/**
 * One recorded impression or click.
 *
 * The denormalised counters on campaign and creative answer "how many in total";
 * these rows are what make "how many yesterday", per-placement breakdowns and
 * daily pacing caps possible. They are the highest-volume collection in the
 * module, so they carry a TTL and no back-references beyond ids.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'ad_events',
})
export class AdEvent {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'AdCreative',
    required: true,
    index: true,
  })
  creativeId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'AdCampaign',
    required: true,
    index: true,
  })
  campaignId!: Types.ObjectId;

  @Prop({ type: String, enum: AdEventType, required: true })
  type!: AdEventType;

  @Prop({ type: String, enum: AdPlacement, required: true })
  placement!: AdPlacement;

  /**
   * Anonymous client identifier used to collapse repeat impressions of the same
   * creative within a session, so a user scrolling past a slot twice is not
   * counted twice.
   */
  @Prop({ type: String, index: true })
  sessionId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  createdAt!: Date;
}

export const AdEventSchema = SchemaFactory.createForClass(AdEvent);

// Reporting: totals per campaign/creative over a date range.
AdEventSchema.index({ campaignId: 1, type: 1, createdAt: -1 });
AdEventSchema.index({ creativeId: 1, type: 1, createdAt: -1 });
// Session de-duplication of impressions.
AdEventSchema.index({ creativeId: 1, sessionId: 1, type: 1 });
// Raw events are only needed for recent reporting; totals live on the campaign.
AdEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 180 },
);
