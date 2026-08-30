import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { containsRegex } from '../common/utils/sanitize-regex.js';
import {
  IdVerification,
  IdVerificationDocument,
  IdVerificationStatus,
} from './schemas/id-verification.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { StorageService } from '../listings/storage.service.js';
import { ListingsService } from '../listings/listings.service.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { MAX_ID_VERIFICATION_ATTEMPTS } from '../common/constants/app.constants.js';
import { computeBufferHash } from '../common/utils/file-hash.js';

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
    private readonly listingsService: ListingsService,
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
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
    }

    const user = await this.userModel.findById(userId).lean();
    if (user?.idVerified) {
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
    }

    // Three submissions in total, then the user has to come through support.
    // Checked before any image is written so an exhausted user cannot keep
    // filling storage with uploads that will be refused.
    if (
      (await this.countUsedAttempts(userOid)) >= MAX_ID_VERIFICATION_ATTEMPTS
    ) {
      throw new BadRequestException(
        PUBLIC_ERROR.ID_VERIFICATION_ATTEMPTS_EXHAUSTED,
      );
    }

    // Reject duplicate images
    const hashes = [
      computeBufferHash(files.cnicFront.buffer),
      computeBufferHash(files.cnicBack.buffer),
      computeBufferHash(files.selfieFront.buffer),
      computeBufferHash(files.selfieBack.buffer),
    ];
    if (new Set(hashes).size !== hashes.length) {
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
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

  /**
   * Submissions already spent, counting admin rejections only.
   *
   * `reviewedBy` is the discriminator rather than the rejection reason string:
   * the auto-expire cron sets a status and a reason but never a reviewer, so an
   * unreviewed submission is distinguishable without matching on prose.
   */
  private countUsedAttempts(userOid: Types.ObjectId): Promise<number> {
    return this.verificationModel
      .countDocuments({
        userId: userOid,
        status: IdVerificationStatus.REJECTED,
        reviewedBy: { $exists: true },
      })
      .exec();
  }

  /**
   * The latest submission plus how many attempts are left, so the form can warn
   * before the last one is spent rather than only failing on submit.
   */
  async getMyVerification(userId: string): Promise<
    | (IdVerificationDocument & {
        attemptsUsed: number;
        attemptsRemaining: number;
        maxAttempts: number;
      })
    | null
  > {
    const userOid = new Types.ObjectId(userId);
    const [verification, attemptsUsed] = await Promise.all([
      this.verificationModel
        .findOne({ userId: userOid })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.countUsedAttempts(userOid),
    ]);
    if (!verification) return null;
    return {
      ...(verification as any),
      attemptsUsed,
      attemptsRemaining: Math.max(
        0,
        MAX_ID_VERIFICATION_ATTEMPTS - attemptsUsed,
      ),
      maxAttempts: MAX_ID_VERIFICATION_ATTEMPTS,
    };
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
      const regex = containsRegex(params.search);
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
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
    }

    if (status === IdVerificationStatus.REJECTED && !rejectionReason) {
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
    }

    const verification = await this.verificationModel.findById(verificationId);
    if (!verification) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (verification.status !== IdVerificationStatus.PENDING) {
      throw new BadRequestException(PUBLIC_ERROR.ID_VERIFICATION_FAILED);
    }

    verification.status = status;
    verification.reviewedBy = new Types.ObjectId(adminId);
    verification.reviewedAt = new Date();

    if (status === IdVerificationStatus.REJECTED) {
      verification.rejectionReason = rejectionReason;
    }

    await verification.save();

    // Both outcomes are written, not just approval. Leaving rejection alone made
    // `idVerified` write-once: there was no path anywhere in the app to withdraw
    // it, so an ID approved in error could never be taken back.
    await this.userModel.findByIdAndUpdate(verification.userId, {
      $set: { idVerified: status === IdVerificationStatus.APPROVED },
    });

    // The "Verified seller" badge is a denormalised copy on every one of the
    // seller's listings, so updating the user flag is not enough on its own —
    // without this the badge keeps asserting the previous decision.
    await this.listingsService.syncSellerVerified(String(verification.userId));

    return verification;
  }

  async getVerificationById(id: string): Promise<IdVerificationDocument> {
    const verification = await this.verificationModel
      .findById(id)
      .populate('userId', 'email phone profile')
      .populate('reviewedBy', 'email profile')
      .lean();

    if (!verification) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    return verification as IdVerificationDocument;
  }
}
