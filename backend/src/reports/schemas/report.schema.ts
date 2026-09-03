import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export enum ReportStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** What is being reported. A listing report still resolves to its seller. */
export enum ReportTargetType {
  USER = 'user',
  LISTING = 'listing',
}

/** Why the reporter says the target is objectionable. */
export enum ReportReason {
  SPAM = 'spam',
  SCAM = 'scam',
  PROHIBITED = 'prohibited',
  OFFENSIVE = 'offensive',
  COUNTERFEIT = 'counterfeit',
  OTHER = 'other',
}

/** A screenshot the reporter attached as evidence. Mirrors `CnicImage`. */
@Schema({ _id: false })
export class ReportImage {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String, required: true })
  key!: string;
}

@Schema({
  timestamps: true,
  collection: 'reports',
  toJSON: {
    transform: (_doc: any, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Report {
  _id!: Types.ObjectId;

  /** Who filed the report. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId!: Types.ObjectId;

  @Prop({ type: String, enum: ReportTargetType, required: true })
  targetType!: ReportTargetType;

  /**
   * The user the report counts against. Always set — for a listing report this
   * is resolved from the listing's seller at submit time, so approval can
   * increment the right person's count without a second lookup.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reportedUserId!: Types.ObjectId;

  /** The reported listing, when `targetType === LISTING`. */
  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  reportedListingId?: Types.ObjectId;

  @Prop({ type: String, enum: ReportReason, default: ReportReason.OTHER })
  reason!: ReportReason;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: [ReportImage], default: [] })
  screenshots!: ReportImage[];

  @Prop({
    type: String,
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status!: ReportStatus;

  /** Admin note recorded when rejecting (or approving with a comment). */
  @Prop({ type: String })
  reviewNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Admin queue: newest first, filterable by status.
ReportSchema.index({ status: 1, createdAt: -1 });
// Count / list all reports against a given user.
ReportSchema.index({ reportedUserId: 1, status: 1 });
// Stop a reporter filing the same target twice while one is still pending.
ReportSchema.index(
  { reporterId: 1, targetType: 1, reportedListingId: 1, reportedUserId: 1 },
  { partialFilterExpression: { status: ReportStatus.PENDING } },
);
