import { Model, Types } from 'mongoose';
import { UserDocument } from './schemas/user.schema.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
export declare class UsersService {
    private readonly userModel;
    constructor(userModel: Model<UserDocument>);
    findById(id: string | Types.ObjectId): Promise<UserDocument>;
    findByEmail(email: string): Promise<UserDocument | null>;
    findByPhone(phone: string): Promise<UserDocument | null>;
    updateProfile(userId: string | Types.ObjectId, dto: UpdateProfileDto): Promise<UserDocument>;
    sanitizeUser(user: UserDocument): Record<string, unknown>;
}
