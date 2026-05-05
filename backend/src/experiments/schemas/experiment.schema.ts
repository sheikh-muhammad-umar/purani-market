import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExperimentDocument = HydratedDocument<Experiment>;

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

@Schema({ _id: false })
export class ExperimentVariant {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  /** Traffic allocation percentage (0-100). All variants must sum to 100. */
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  weight!: number;

  /** Arbitrary config passed to the client/search logic */
  @Prop({ type: Object, default: {} })
  config!: Record<string, any>;
}

@Schema({ timestamps: true, collection: 'experiments' })
export class Experiment {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({
    type: String,
    enum: ExperimentStatus,
    default: ExperimentStatus.DRAFT,
  })
  status!: ExperimentStatus;

  @Prop({ type: [ExperimentVariant], required: true })
  variants!: ExperimentVariant[];

  /** Optional: only apply to users matching this filter (e.g. { role: 'user' }) */
  @Prop({ type: Object })
  targetFilter?: Record<string, any>;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ExperimentSchema = SchemaFactory.createForClass(Experiment);
