import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdvertiserStatus } from '../advertising.enums.js';

export type AdvertiserDocument = HydratedDocument<Advertiser>;

/**
 * A brand that buys advertising space.
 *
 * Separate from `User`: advertisers are managed by staff and do not sign in, so
 * they carry contact details rather than credentials.
 */
@Schema({ timestamps: true, collection: 'advertisers' })
export class Advertiser {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, trim: true })
  contactName?: string;

  @Prop({ type: String, trim: true, lowercase: true })
  contactEmail?: string;

  @Prop({ type: String, trim: true })
  contactPhone?: string;

  @Prop({ type: String, trim: true })
  website?: string;

  @Prop({ type: String, trim: true })
  logoUrl?: string;

  /** Free-form internal notes, e.g. agency or billing context. */
  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({
    type: String,
    enum: AdvertiserStatus,
    default: AdvertiserStatus.ACTIVE,
    index: true,
  })
  status!: AdvertiserStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AdvertiserSchema = SchemaFactory.createForClass(Advertiser);

// Staff search advertisers by brand name.
AdvertiserSchema.index({ name: 'text' });

/**
 * One record per brand, compared without regard to case.
 *
 * Campaign spend, delivery and reporting all hang off `advertiserId`, so a second
 * record for the same brand silently splits its numbers with nothing in the UI to
 * explain the gap. The service checks for a clash before writing, but that is
 * read-then-write; this index is what actually holds under two concurrent
 * creates. `strength: 2` compares case-insensitively while still honouring
 * accents, and `trim` on the property already removes surrounding space.
 *
 * Existing duplicates make this index fail to build. `scripts/fix-advertiser-name-index.js`
 * reports them and creates the index once the collection is clean.
 */
AdvertiserSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    name: 'advertiser_name_unique_ci',
  },
);
