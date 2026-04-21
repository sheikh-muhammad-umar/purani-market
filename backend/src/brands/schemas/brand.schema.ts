import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BrandDocument = HydratedDocument<Brand>;

@Schema({ timestamps: true, collection: 'brands' })
export class Brand {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 100 })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: String })
  logo?: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);

BrandSchema.index({ categoryId: 1 });
BrandSchema.index({ name: 1, categoryId: 1 }, { unique: true });
