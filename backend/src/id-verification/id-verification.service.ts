import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  IdVerification,
  IdVerificationDocument,
  IdVerificationStatus,
} from './schemas/id-verification.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { StorageService } from '../listings/storage.service.js';
import { ERROR } from '../common/constants/error-messages.js';

const UPLOAD_FOLDER = 'id-verification';

export interface VerificationFiles {
  cnicFront: Express.Multer.File;
  cnicBack: Express.Multer.File;
  selfieFront: Express.Multer.File;
  selfieBack: Express.Multer.File;
}

export interface PaginatedVerifications {
  data: IdVerificationDocument[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class IdVerificationService {
  constructor(
    @InjectModel(IdVerification.name)
    private readonly verificationModel: Model<IdVerificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly storageService: StorageService,
  ) {}

  async submitVerification(
    userId: string,
    files: VerificationFiles,
  ): Promise<IdVerificationDocument> {
    const userOid = new Types.ObjectId(userId);

    const existing = await this.verificationModel.findOne({
      userId: userOid,
      status: IdVerificationStatus.PENDING,
    });

    if (existing) {
      throw new BadRequestException(ERROR.VERIFICATION_ALREADY_PENDING);
    }

    const user = await this.userModel.findById(userId).lean();
    if (user?.idVerified) {
      throw new BadRequestException(ERROR.VERIFICATION_ALREADY_VERIFIED);
    }

    const [
      cnicFrontResult,
      cnicBackResult,
      selfieFrontResult,
      selfieBackResult,
    ] = await Promise.all([
      this.storageService.saveFile(
        UPLOAD_FOLDER,
        files.cnicFront.originalname,
        files.cnicFront.buffer,
      ),
      this.storageService.saveFile(
        UPLOAD_FOLDER,
        files.cnicBack.originalname,
        files.cnicBack.buffer,
      ),
      this.storageService.saveFile(
        UPLOAD_FOLDER,
        files.selfieFront.originalname,
        files.selfieFront.buffer,
      ),
      this.storageService.saveFile(
        UPLOAD_FOLDER,
        files.selfieBack.originalname,
        files.selfieBack.buffer,
      ),
    ]);

    return this.verificationModel.create({
      userId: userOid,
      cnicFront: { url: cnicFrontResult.fileUrl, key: cnicFrontResult.key },
      cnicBack: { url: cnicBackResult.fileUrl, key: cnicBackResult.key },
      selfieFront: {
        url: selfieFrontResult.fileUrl,
        key: selfieFrontResult.key,
      },
      selfieBack: { url: selfieBackResult.fileUrl, key: selfieBackResult.key },
      status: IdVerificationStatus.PENDING,
    });
  }

  async getMyVerification(
    userId: string,
  ): Promise<IdVerificationDocument | null> {
    return this.verificationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getAllVerifications(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    } = {},
  ): Promise<PaginatedVerifications> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.status) {
      filter.status = params.status;
    }

    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ];

    if (params.search) {
      const regex = new RegExp(params.search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'user.email': regex },
            { 'user.phone': regex },
            { 'user.profile.firstName': regex },
            { 'user.profile.lastName': regex },
          ],
        },
      });
    }

    const countPipeline: PipelineStage[] = [
      ...pipeline,
      { $count: 'total' as const },
    ];
    const dataPipeline: PipelineStage[] = [
      ...pipeline,
      { $sort: { createdAt: -1 as const } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          userId: 1,
          cnicFront: 1,
          cnicBack: 1,
          selfieFront: 1,
          selfieBack: 1,
          status: 1,
          rejectionReason: 1,
          reviewedBy: 1,
          reviewedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          'user.email': 1,
          'user.phone': 1,
          'user.profile': 1,
        },
      },
    ];

    const [countResult, data] = await Promise.all([
      this.verificationModel.aggregate(countPipeline),
      this.verificationModel.aggregate(dataPipeline),
    ]);

    const total = countResult[0]?.total || 0;

    return { data, total, page, limit };
  }

  async reviewVerification(
    verificationId: string,
    adminId: string,
    status: IdVerificationStatus,
    rejectionReason?: string,
  ): Promise<IdVerificationDocument> {
    if (status === IdVerificationStatus.PENDING) {
      throw new BadRequestException(ERROR.VERIFICATION_CANNOT_SET_PENDING);
    }

    if (status === IdVerificationStatus.REJECTED && !rejectionReason) {
      throw new BadRequestException(
        ERROR.VERIFICATION_REJECTION_REASON_REQUIRED,
      );
    }

    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException(ERROR.VERIFICATION_NOT_FOUND);
    }

    if (verification.status !== IdVerificationStatus.PENDING) {
      throw new BadRequestException(ERROR.VERIFICATION_ALREADY_REVIEWED);
    }

    verification.status = status;
    verification.reviewedBy = new Types.ObjectId(adminId);
    verification.reviewedAt = new Date();

    if (status === IdVerificationStatus.REJECTED) {
      verification.rejectionReason = rejectionReason;
    }

    await verification.save();

    if (status === IdVerificationStatus.APPROVED) {
      await this.userModel.findByIdAndUpdate(verification.userId, {
        $set: { idVerified: true },
      });
    }

    return verification;
  }

  async getVerificationById(id: string): Promise<IdVerificationDocument> {
    const verification = await this.verificationModel
      .findById(id)
      .populate('userId', 'email phone profile')
      .populate('reviewedBy', 'email profile')
      .lean();

    if (!verification) {
      throw new NotFoundException(ERROR.VERIFICATION_NOT_FOUND);
    }

    return verification as IdVerificationDocument;
  }
}
