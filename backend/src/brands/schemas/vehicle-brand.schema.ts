import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export type VehicleBrandDocument = HydratedDocument<VehicleBrand>;

@Schema({ timestamps: true, collection: 'vehicle_brands' })
export class VehicleBrand {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 100 })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: String, enum: VehicleType, required: true })
  vehicleType!: VehicleType;

  @Prop({ type: String })
  logo?: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VehicleBrandSchema = SchemaFactory.createForClass(VehicleBrand);

VehicleBrandSchema.index({ categoryId: 1 });
VehicleBrandSchema.index({ vehicleType: 1 });
VehicleBrandSchema.index({ name: 1, categoryId: 1 }, { unique: true });
