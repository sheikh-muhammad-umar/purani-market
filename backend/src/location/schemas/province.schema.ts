import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProvinceDocument = HydratedDocument<Province>;

@Schema({ timestamps: true, collection: 'provinces' })
export class Province {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  name!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProvinceSchema = SchemaFactory.createForClass(Province);
