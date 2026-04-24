import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AttributeDefinition,
  AttributeDefinitionDocument,
} from './schemas/attribute-definition.schema.js';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto.js';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto.js';

@Injectable()
export class AttributeDefinitionsService {
  constructor(
    @InjectModel(AttributeDefinition.name)
    private readonly model: Model<AttributeDefinitionDocument>,
  ) {}

  async findAll(): Promise<AttributeDefinitionDocument[]> {
    return this.model.find().sort({ name: 1 }).lean().exec() as any;
  }

  async findById(id: string): Promise<AttributeDefinitionDocument> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Attribute definition not found');
    return doc;
  }

  async findByKey(key: string): Promise<AttributeDefinitionDocument | null> {
    return this.model.findOne({ key }).exec();
  }

  async findByIds(ids: string[]): Promise<AttributeDefinitionDocument[]> {
    return this.model.find({ _id: { $in: ids } }).exec();
  }

  async create(
    dto: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionDocument> {
    const existing = await this.findByKey(dto.key);
    if (existing) {
      throw new ConflictException(
        `Attribute with key "${dto.key}" already exists`,
      );
    }
    return this.model.create(dto);
  }

  async update(
    id: string,
    dto: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionDocument> {
    const doc = await this.findById(id);
    if (dto.key && dto.key !== doc.key) {
      const existing = await this.findByKey(dto.key);
      if (existing) {
        throw new ConflictException(
          `Attribute with key "${dto.key}" already exists`,
        );
      }
    }
    Object.assign(doc, dto);
    return doc.save();
  }

  async remove(id: string): Promise<void> {
    const doc = await this.findById(id);
    await doc.deleteOne();
  }

  async search(query: string): Promise<AttributeDefinitionDocument[]> {
    const regex = new RegExp(query, 'i');
    return this.model
      .find({ $or: [{ name: regex }, { key: regex }] })
      .sort({ name: 1 })
      .limit(20)
      .lean()
      .exec() as any;
  }
}
