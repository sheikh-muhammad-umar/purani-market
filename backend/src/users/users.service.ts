import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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

    if (dto.notificationPreferences !== undefined) {
      for (const [key, value] of Object.entries(dto.notificationPreferences)) {
        if (value !== undefined) {
          updateFields[`notificationPreferences.${key}`] = value;
        }
      }
    }

    if (Object.keys(updateFields).length === 0) {
      const current = await this.userModel.findById(userId).exec();
      if (!current) {
        throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
      }
      return current;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateFields }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    return user;
  }

  /**
   * Strip sensitive fields before returning user data to the client.
   */
  /**
   * Strip sensitive fields before returning user data to the client.
   *
   * Goes through `toJSON()` so the schema's own transform is the single place
   * that decides what is secret. It used to use `toObject()`, which skips that
   * transform, and then re-deleted a shorter list by hand — so `/api/users/me`
   * returned `pendingEmailChange.verificationToken`, the live token that
   * completes an email change, alongside `pendingPhoneChange.otpHash`, a hash of
   * a six-digit code that is trivially brute-forced offline. Anything that could
   * read that response body could take the account over.
   *
   * `deviceTokens` are dropped on top: push-notification handles have no reason
   * to appear in a profile response.
   */
  sanitizeUser(user: UserDocument): Record<string, unknown> {
    const obj = user.toJSON() as unknown as Record<string, unknown>;
    delete obj['deviceTokens'];
    return obj;
  }

  async getPublicProfile(userId: string): Promise<Record<string, any>> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const user = await this.userModel
      .findById(userId)
      .select(
        'profile emailVerified phoneVerified idVerified createdAt averageRating reviewCount',
      )
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return {
      _id: user._id.toString(),
      name:
        `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() ||
        'User',
      avatar: user.profile?.avatar || '',
      city: user.profile?.city || '',
      emailVerified: user.emailVerified ?? false,
      phoneVerified: user.phoneVerified ?? false,
      idVerified: user.idVerified ?? false,
      memberSince: user.createdAt,
      averageRating: user.averageRating ?? 0,
      reviewCount: user.reviewCount ?? 0,
    };
  }
}
