import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CityDocument = HydratedDocument<City>;

@Schema({ timestamps: true, collection: 'cities' })
export class City {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Province', required: true, index: true })
  provinceId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ provinceId: 1, name: 1 }, { unique: true });
