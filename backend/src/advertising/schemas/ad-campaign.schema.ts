import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AdCampaignStatus,
  AdDevice,
  AdPlacement,
  AdPricingModel,
} from '../advertising.enums.js';

export type AdCampaignDocument = HydratedDocument<AdCampaign>;

/**
 * Who a campaign is allowed to reach.
 *
 * Empty arrays mean "no restriction" rather than "match nothing", so a campaign
 * with no targeting runs everywhere its placements exist.
 */
@Schema({ _id: false })
export class AdTargeting {
  /** Placements this campaign may occupy. At least one is required. */
  @Prop({ type: [String], enum: AdPlacement, default: [] })
  placements!: AdPlacement[];

  /** Restrict to these categories, including their descendants. */
  @Prop({ type: [Types.ObjectId], ref: 'Category', default: [] })
  categoryIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Province', default: [] })
  provinceIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'City', default: [] })
  cityIds!: Types.ObjectId[];

  @Prop({ type: [String], enum: AdDevice, default: [] })
  devices!: AdDevice[];
}

/** Running totals, denormalised so listing campaigns needs no aggregation. */
@Schema({ _id: false })
export class AdMetrics {
  @Prop({ type: Number, default: 0, min: 0 })
  impressions!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  clicks!: number;
}

/**
 * A flight of advertising bought by one advertiser.
 *
 * Holds the schedule, targeting and delivery caps; the actual images live on
 * `AdCreative` so one campaign can run several sizes or messages at once.
 */
@Schema({ timestamps: true, collection: 'ad_campaigns' })
export class AdCampaign {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Advertiser',
    required: true,
    index: true,
  })
  advertiserId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({
    type: String,
    enum: AdCampaignStatus,
    default: AdCampaignStatus.DRAFT,
    index: true,
  })
  status!: AdCampaignStatus;

  @Prop({ type: Date, required: true })
  startAt!: Date;

  @Prop({ type: Date, required: true })
  endAt!: Date;

  /**
   * Relative share of traffic when several campaigns compete for one slot.
   * Higher wins more often; it is a weight, not a hard ordering.
   */
  @Prop({ type: Number, default: 5, min: 1, max: 100 })
  priority!: number;

  @Prop({ type: String, enum: AdPricingModel, default: AdPricingModel.FLAT })
  pricingModel!: AdPricingModel;

  @Prop({ type: Number, default: 0, min: 0 })
  budgetAmount!: number;

  @Prop({ type: String, default: 'PKR' })
  currency!: string;

  /** Stop serving once this many impressions are delivered. 0 means no cap. */
  @Prop({ type: Number, default: 0, min: 0 })
  maxImpressions!: number;

  /** Stop serving once this many clicks are delivered. 0 means no cap. */
  @Prop({ type: Number, default: 0, min: 0 })
  maxClicks!: number;

  /** Per-day impression ceiling used to spread delivery. 0 means no cap. */
  @Prop({ type: Number, default: 0, min: 0 })
  dailyImpressionCap!: number;

  @Prop({ type: AdTargeting, default: () => ({}) })
  targeting!: AdTargeting;

  @Prop({ type: AdMetrics, default: () => ({}) })
  metrics!: AdMetrics;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AdCampaignSchema = SchemaFactory.createForClass(AdCampaign);

// The serving path always filters on status plus the schedule window.
AdCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
// Supports the cron that promotes scheduled campaigns and completes expired ones.
AdCampaignSchema.index({ status: 1, endAt: 1 });
