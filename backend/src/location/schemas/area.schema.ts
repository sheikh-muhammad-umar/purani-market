import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AreaDocument = HydratedDocument<Area>;

@Schema({ timestamps: true, collection: 'areas' })
export class Area {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'City', required: true, index: true })
  cityId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  subareas!: string[];

  @Prop({ type: [String], default: [] })
  blockPhases!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const AreaSchema = SchemaFactory.createForClass(Area);

AreaSchema.index({ cityId: 1, name: 1 }, { unique: true });
