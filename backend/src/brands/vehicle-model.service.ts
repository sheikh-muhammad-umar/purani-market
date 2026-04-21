import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VehicleModel,
  VehicleModelDocument,
} from './schemas/vehicle-model.schema.js';
import {
  VehicleVariant,
  VehicleVariantDocument,
} from './schemas/vehicle-variant.schema.js';
import {
  VehicleBrand,
  VehicleBrandDocument,
} from './schemas/vehicle-brand.schema.js';
import {
  CreateVehicleModelDto,
  UpdateVehicleModelDto,
} from './dto/vehicle-model.dto.js';

@Injectable()
export class VehicleModelService {
  constructor(
    @InjectModel(VehicleModel.name)
    private readonly vehicleModelModel: Model<VehicleModelDocument>,
    @InjectModel(VehicleVariant.name)
    private readonly vehicleVariantModel: Model<VehicleVariantDocument>,
    @InjectModel(VehicleBrand.name)
    private readonly brandModel: Model<VehicleBrandDocument>,
  ) {}

  async findByBrand(
    brandId: string,
    activeOnly = true,
  ): Promise<VehicleModelDocument[]> {
    if (!Types.ObjectId.isValid(brandId)) {
      throw new BadRequestException('Invalid brand ID');
    }
    const filter: Record<string, any> = {
      brandId: new Types.ObjectId(brandId),
    };
    if (activeOnly) filter.isActive = true;
    return this.vehicleModelModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  async findByCategory(
    categoryId: string,
    activeOnly = true,
  ): Promise<VehicleModelDocument[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }
    const filter: Record<string, any> = {
      categoryId: new Types.ObjectId(categoryId),
    };
    if (activeOnly) filter.isActive = true;
    return this.vehicleModelModel
      .find(filter)
      .populate('brandId', 'name')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<VehicleModelDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Vehicle model not found');
    }
    const model = await this.vehicleModelModel
      .findById(id)
      .populate('brandId', 'name')
      .lean()
      .exec();
    if (!model) throw new NotFoundException('Vehicle model not found');
    return model;
  }

  async create(dto: CreateVehicleModelDto): Promise<VehicleModelDocument> {
    // Validate brand exists
    const brand = await this.brandModel.findById(dto.brandId).exec();
    if (!brand) throw new BadRequestException('Brand not found');

    return await new this.vehicleModelModel({
      name: dto.name,
      brandId: new Types.ObjectId(dto.brandId),
      categoryId: new Types.ObjectId(dto.categoryId),
      vehicleType: dto.vehicleType,
      isActive: dto.isActive ?? true,
    }).save();
  }

  async update(
    id: string,
    dto: UpdateVehicleModelDto,
  ): Promise<VehicleModelDocument> {
    const model = await this.vehicleModelModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!model) throw new NotFoundException('Vehicle model not found');
    return model;
  }

  async delete(id: string): Promise<void> {
    // Check for variants under this model
    const variantCount = await this.vehicleVariantModel
      .countDocuments({ modelId: new Types.ObjectId(id) })
      .exec();
    if (variantCount > 0) {
      throw new BadRequestException(
        `Cannot delete model with ${variantCount} variant(s). Delete variants first.`,
      );
    }
    const result = await this.vehicleModelModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Vehicle model not found');
  }

  async bulkCreate(
    models: CreateVehicleModelDto[],
  ): Promise<VehicleModelDocument[]> {
    const docs = models.map((dto) => ({
      name: dto.name,
      brandId: new Types.ObjectId(dto.brandId),
      categoryId: new Types.ObjectId(dto.categoryId),
      vehicleType: dto.vehicleType,
      isActive: dto.isActive ?? true,
    }));
    return this.vehicleModelModel.insertMany(docs, { ordered: false });
  }
}
