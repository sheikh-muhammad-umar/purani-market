import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Brand, BrandDocument } from './schemas/brand.schema.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto.js';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name)
    private readonly brandModel: Model<BrandDocument>,
  ) {}

  async findByCategory(
    categoryId: string,
    activeOnly = true,
  ): Promise<BrandDocument[]> {
    const filter: Record<string, any> = {
      categoryId: new Types.ObjectId(categoryId),
    };
    if (activeOnly) filter.isActive = true;
    return this.brandModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  async findAll(activeOnly = false): Promise<BrandDocument[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.brandModel
      .find(filter)
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<BrandDocument> {
    const brand = await this.brandModel.findById(id).lean().exec();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto): Promise<BrandDocument> {
    return await new this.brandModel({
      name: dto.name,
      categoryId: new Types.ObjectId(dto.categoryId),
      logo: dto.logo,
      isActive: dto.isActive ?? true,
    }).save();
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDocument> {
    const brand = await this.brandModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async delete(id: string): Promise<void> {
    const result = await this.brandModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Brand not found');
  }
}
