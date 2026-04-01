import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async updateProfile(
    userId: string | Types.ObjectId,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const updateFields: Record<string, unknown> = {};

    if (dto.firstName !== undefined) {
      updateFields['profile.firstName'] = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      updateFields['profile.lastName'] = dto.lastName;
    }
    if (dto.avatar !== undefined) {
      updateFields['profile.avatar'] = dto.avatar;
    }
    if (dto.location !== undefined) {
      updateFields['profile.location'] = {
        type: dto.location.type ?? 'Point',
        coordinates: dto.location.coordinates ?? [0, 0],
      };
    }
    if (dto.city !== undefined) {
      updateFields['profile.city'] = dto.city;
    }
    if (dto.postalCode !== undefined) {
      updateFields['profile.postalCode'] = dto.postalCode;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateFields }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Strip sensitive fields before returning user data to the client.
   */
  sanitizeUser(user: UserDocument): Record<string, unknown> {
    const obj = user.toObject() as unknown as Record<string, unknown>;
    delete obj['passwordHash'];
    delete obj['__v'];
    if (obj['mfa'] && typeof obj['mfa'] === 'object') {
      delete (obj['mfa'] as Record<string, unknown>)['totpSecret'];
    }
    return obj;
  }
}
