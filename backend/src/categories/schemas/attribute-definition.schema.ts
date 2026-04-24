import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AttributeType } from './category.schema.js';

export type AttributeDefinitionDocument = HydratedDocument<AttributeDefinition>;

@Schema({ timestamps: true, collection: 'attribute_definitions' })
export class AttributeDefinition {
  _id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: String, enum: AttributeType, required: true })
  type!: AttributeType;

  @Prop({ type: [String], default: [] })
  options!: string[];

  @Prop({ type: String })
  unit?: string;

  @Prop({ type: Number })
  rangeMin?: number;

  @Prop({ type: Number })
  rangeMax?: number;

  @Prop({ type: Boolean, default: false })
  allowOther!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttributeDefinitionSchema =
  SchemaFactory.createForClass(AttributeDefinition);

AttributeDefinitionSchema.index({ name: 'text' });
