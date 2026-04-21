import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VehicleVariant,
  VehicleVariantDocument,
} from './schemas/vehicle-variant.schema.js';
import {
  VehicleModel,
  VehicleModelDocument,
} from './schemas/vehicle-model.schema.js';
import {
  CreateVehicleVariantDto,
  UpdateVehicleVariantDto,
} from './dto/vehicle-variant.dto.js';

@Injectable()
export class VehicleVariantService {
  constructor(
    @InjectModel(VehicleVariant.name)
    private readonly vehicleVariantModel: Model<VehicleVariantDocument>,
    @InjectModel(VehicleModel.name)
    private readonly vehicleModelModel: Model<VehicleModelDocument>,
  ) {}

  async findByModel(
    modelId: string,
    activeOnly = true,
  ): Promise<VehicleVariantDocument[]> {
    if (!Types.ObjectId.isValid(modelId)) {
      throw new BadRequestException('Invalid model ID');
    }
    const filter: Record<string, any> = {
      modelId: new Types.ObjectId(modelId),
    };
    if (activeOnly) filter.isActive = true;
    return this.vehicleVariantModel
      .find(filter)
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findByBrand(
    brandId: string,
    activeOnly = true,
  ): Promise<VehicleVariantDocument[]> {
    if (!Types.ObjectId.isValid(brandId)) {
      throw new BadRequestException('Invalid brand ID');
    }
    const filter: Record<string, any> = {
      brandId: new Types.ObjectId(brandId),
    };
    if (activeOnly) filter.isActive = true;
    return this.vehicleVariantModel
      .find(filter)
      .populate('modelId', 'name')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<VehicleVariantDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Vehicle variant not found');
    }
    const variant = await this.vehicleVariantModel
      .findById(id)
      .populate('modelId', 'name')
      .populate('brandId', 'name')
      .lean()
      .exec();
    if (!variant) throw new NotFoundException('Vehicle variant not found');
    return variant;
  }

  async create(dto: CreateVehicleVariantDto): Promise<VehicleVariantDocument> {
    // Validate model exists
    const model = await this.vehicleModelModel.findById(dto.modelId).exec();
    if (!model) throw new BadRequestException('Vehicle model not found');

    return await new this.vehicleVariantModel({
      name: dto.name,
      modelId: new Types.ObjectId(dto.modelId),
      brandId: new Types.ObjectId(dto.brandId),
      categoryId: new Types.ObjectId(dto.categoryId),
      vehicleType: dto.vehicleType,
      isActive: dto.isActive ?? true,
    }).save();
  }

  async update(
    id: string,
    dto: UpdateVehicleVariantDto,
  ): Promise<VehicleVariantDocument> {
    const variant = await this.vehicleVariantModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!variant) throw new NotFoundException('Vehicle variant not found');
    return variant;
  }

  async delete(id: string): Promise<void> {
    const result = await this.vehicleVariantModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Vehicle variant not found');
  }

  async bulkCreate(
    variants: CreateVehicleVariantDto[],
  ): Promise<VehicleVariantDocument[]> {
    const docs = variants.map((dto) => ({
      name: dto.name,
      modelId: new Types.ObjectId(dto.modelId),
      brandId: new Types.ObjectId(dto.brandId),
      categoryId: new Types.ObjectId(dto.categoryId),
      vehicleType: dto.vehicleType,
      isActive: dto.isActive ?? true,
    }));
    return this.vehicleVariantModel.insertMany(docs, { ordered: false });
  }
}
