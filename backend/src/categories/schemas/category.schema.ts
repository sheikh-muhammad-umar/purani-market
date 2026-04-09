import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  BOOLEAN = 'boolean',
  RANGE = 'range',
  YEAR = 'year',
}

@Schema({ _id: false })
export class CategoryAttribute {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  key!: string;

  @Prop({ type: String, enum: AttributeType, required: true })
  type!: AttributeType;

  @Prop({ type: [String], default: [] })
  options!: string[];

  @Prop({ type: Boolean, default: false })
  required!: boolean;

  @Prop({ type: String })
  unit?: string;

  @Prop({ type: Number })
  rangeMin?: number;

  @Prop({ type: Number })
  rangeMax?: number;
}

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ type: Number, required: true, min: 1, max: 3 })
  level!: number;

  @Prop({ type: [CategoryAttribute], default: [] })
  attributes!: CategoryAttribute[];

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Indexes
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ level: 1 });
