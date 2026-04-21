import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export type VehicleVariantDocument = HydratedDocument<VehicleVariant>;

@Schema({ timestamps: true, collection: 'vehicle_variants' })
export class VehicleVariant {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 150 })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'VehicleModel', required: true })
  modelId!: Types.ObjectId;

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

export const VehicleVariantSchema =
  SchemaFactory.createForClass(VehicleVariant);

VehicleVariantSchema.index({ modelId: 1 });
VehicleVariantSchema.index({ brandId: 1 });
VehicleVariantSchema.index({ categoryId: 1 });
VehicleVariantSchema.index({ vehicleType: 1 });
VehicleVariantSchema.index({ name: 1, modelId: 1 }, { unique: true });
