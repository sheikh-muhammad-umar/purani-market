import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShortsPackageDocument = HydratedDocument<ShortsPackage>;

@Schema({ timestamps: true, collection: 'shorts_packages' })
export class ShortsPackage {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number; // number of shorts allowed

  @Prop({ type: Number, required: true, min: 1 })
  duration!: number; // days the shorts stay active

  @Prop({ type: Number, required: true, min: 0 })
  price!: number;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: String })
  description?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShortsPackageSchema = SchemaFactory.createForClass(ShortsPackage);

ShortsPackageSchema.index({ isActive: 1 });
