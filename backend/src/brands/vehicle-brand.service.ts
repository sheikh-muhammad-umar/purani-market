import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VehicleBrand,
  VehicleBrandDocument,
} from './schemas/vehicle-brand.schema.js';
import {
  VehicleModel,
  VehicleModelDocument,
} from './schemas/vehicle-model.schema.js';
import {
  CreateVehicleBrandDto,
  UpdateVehicleBrandDto,
} from './dto/vehicle-brand.dto.js';
import { ERROR } from '../common/constants/error-messages.js';

@Injectable()
export class VehicleBrandService {
  constructor(
    @InjectModel(VehicleBrand.name)
    private readonly vehicleBrandModel: Model<VehicleBrandDocument>,
    @InjectModel(VehicleModel.name)
    private readonly vehicleModelModel: Model<VehicleModelDocument>,
  ) {}

  async findByCategory(
    categoryId: string,
    activeOnly = true,
  ): Promise<VehicleBrandDocument[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException(ERROR.INVALID_CATEGORY_ID);
    }
    const filter: Record<string, any> = {
      categoryId: new Types.ObjectId(categoryId),
    };
    if (activeOnly) filter.isActive = true;
    return this.vehicleBrandModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  async countByCategory(categoryId: string): Promise<number> {
    if (!Types.ObjectId.isValid(categoryId)) return 0;
    return this.vehicleBrandModel
      .countDocuments({ categoryId: new Types.ObjectId(categoryId) })
      .exec();
  }

  async findAll(activeOnly = false): Promise<VehicleBrandDocument[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.vehicleBrandModel
      .find(filter)
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findByVehicleType(
    vehicleType: string,
    activeOnly = true,
  ): Promise<VehicleBrandDocument[]> {
    const filter: Record<string, any> = { vehicleType };
    if (activeOnly) filter.isActive = true;
    return this.vehicleBrandModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  async findById(id: string): Promise<VehicleBrandDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(ERROR.VEHICLE_BRAND_NOT_FOUND);
    }
    const brand = await this.vehicleBrandModel.findById(id).lean().exec();
    if (!brand) throw new NotFoundException(ERROR.VEHICLE_BRAND_NOT_FOUND);
    return brand;
  }

  async create(dto: CreateVehicleBrandDto): Promise<VehicleBrandDocument> {
    return await new this.vehicleBrandModel({
      name: dto.name,
      categoryId: new Types.ObjectId(dto.categoryId),
      vehicleType: dto.vehicleType,
      logo: dto.logo,
      isActive: dto.isActive ?? true,
    }).save();
  }

  async update(
    id: string,
    dto: UpdateVehicleBrandDto,
  ): Promise<VehicleBrandDocument> {
    const brand = await this.vehicleBrandModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!brand) throw new NotFoundException(ERROR.VEHICLE_BRAND_NOT_FOUND);
    return brand;
  }

  async delete(id: string): Promise<void> {
    // Check for models under this brand
    const modelCount = await this.vehicleModelModel
      .countDocuments({ brandId: new Types.ObjectId(id) })
      .exec();
    if (modelCount > 0) {
      throw new BadRequestException(
        `Cannot delete brand with ${modelCount} model(s). Delete models first.`,
      );
    }
    const result = await this.vehicleBrandModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(ERROR.VEHICLE_BRAND_NOT_FOUND);
  }
}
