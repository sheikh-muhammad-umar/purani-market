import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export type VehicleModelDocument = HydratedDocument<VehicleModel>;

@Schema({ timestamps: true, collection: 'vehicle_models' })
export class VehicleModel {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 100 })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'VehicleBrand', required: true })
  brandId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: String, enum: VehicleType, required: true })
  vehicleType!: VehicleType;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VehicleModelSchema = SchemaFactory.createForClass(VehicleModel);

VehicleModelSchema.index({ brandId: 1 });
VehicleModelSchema.index({ categoryId: 1 });
VehicleModelSchema.index({ vehicleType: 1 });
VehicleModelSchema.index({ name: 1, brandId: 1 }, { unique: true });
