import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdPlacement } from '../advertising.enums.js';
import { AdMetrics } from './ad-campaign.schema.js';

export type AdCreativeDocument = HydratedDocument<AdCreative>;

/**
 * One renderable advertisement belonging to a campaign.
 *
 * A campaign usually carries several: different placements need different aspect
 * ratios, and rotating messages within a placement is how advertisers A/B their
 * creative. The campaign owns scheduling and targeting; a creative only decides
 * what is drawn and where it leads.
 */
@Schema({ timestamps: true, collection: 'ad_creatives' })
export class AdCreative {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'AdCampaign',
    required: true,
    index: true,
  })
  campaignId!: Types.ObjectId;

  @Prop({ type: String, enum: AdPlacement, required: true, index: true })
  placement!: AdPlacement;

  /** Headline, shown for native placements and used as the admin label. */
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  /** Supporting line, native placements only. */
  @Prop({ type: String, trim: true })
  body?: string;

  @Prop({ type: String, required: true, trim: true })
  imageUrl!: string;

  /** Narrower crop for small viewports; falls back to `imageUrl`. */
  @Prop({ type: String, trim: true })
  mobileImageUrl?: string;

  /** Required for accessibility; never defaulted to the brand name silently. */
  @Prop({ type: String, required: true, trim: true })
  altText!: string;

  /** Outbound advertiser URL. Mutually exclusive with `routeLink`. */
  @Prop({ type: String, trim: true })
  destinationUrl?: string;

  /**
   * Internal route, for house ads pointing at a category or campaign page.
   * Mutually exclusive with `destinationUrl`.
   */
  @Prop({ type: String, trim: true })
  routeLink?: string;

  /** Call-to-action label for native placements. */
  @Prop({ type: String, trim: true })
  ctaLabel?: string;

  /** Rotation weight among sibling creatives in the same placement. */
  @Prop({ type: Number, default: 1, min: 1, max: 100 })
  weight!: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: AdMetrics, default: () => ({}) })
  metrics!: AdMetrics;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AdCreativeSchema = SchemaFactory.createForClass(AdCreative);

// Serving looks up active creatives for a placement across eligible campaigns.
AdCreativeSchema.index({ placement: 1, isActive: 1, campaignId: 1 });
