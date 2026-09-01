import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ShortVideo,
  ShortVideoDocument,
  ShortVideoStatus,
} from './schemas/short-video.schema.js';
import {
  ShortsPackage,
  ShortsPackageDocument,
} from './schemas/shorts-package.schema.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentStatus,
  PurchaseType,
} from '../packages/schemas/package-purchase.schema.js';
import { ShortLike, ShortLikeDocument } from './schemas/short-like.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { StorageService } from '../listings/storage.service.js';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { CreateShortDto } from './dto/create-short.dto.js';
import { UpdateShortDto } from './dto/update-short.dto.js';
import { CreateShortsPackageDto } from './dto/create-shorts-package.dto.js';
import { UpdateShortsPackageDto } from './dto/update-shorts-package.dto.js';
import { PurchaseShortsPackageDto } from './dto/purchase-shorts-package.dto.js';
import { ListShortsQueryDto } from './dto/list-shorts-query.dto.js';
import { ShortsVideoService } from './shorts-video.service.js';
import {
  SHORTS_FREE_LIMIT,
  SHORTS_FREE_DURATION_DAYS,
  SHORTS_MAX_FILE_SIZE,
  SHORTS_EXPIRY_REMINDER_DAYS,
  SHORTS_ALLOWED_MIMETYPES,
  DEFAULT_CURRENCY,
} from '../common/constants/app.constants.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { EntitlementKind, remainingOf } from '../packages/entitlements.js';
import { daysToMs, daysFromNow, startOfMonth } from '../common/utils/time.js';

@Injectable()
export class ShortsService {
  private readonly logger = new Logger(ShortsService.name);

  constructor(
    @InjectModel(ShortVideo.name)
    private readonly shortVideoModel: Model<ShortVideoDocument>,
    @InjectModel(ShortsPackage.name)
    private readonly shortsPackageModel: Model<ShortsPackageDocument>,
    @InjectModel(PackagePurchase.name)
    private readonly shortsPurchaseModel: Model<PackagePurchaseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ShortLike.name)
    private readonly shortLikeModel: Model<ShortLikeDocument>,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly adminTrackerService: AdminTrackerService,
    private readonly shortsVideoService: ShortsVideoService,
    private readonly configService: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // SHORT VIDEO CRUD
  // ═══════════════════════════════════════════════════════════

  async createShort(
    sellerId: string,
    file: Express.Multer.File,
    dto: CreateShortDto,
  ): Promise<ShortVideoDocument> {
    // Validate file
    this.validateShortFile(file);

    // Check user's short limits
    const { canPost, reason, purchase } = await this.checkCanPostShort(
      sellerId,
      dto.purchaseId,
    );
    if (!canPost) {
      throw new BadRequestException(reason);
    }

    // Process video: compress and generate thumbnail
    const processed = await this.shortsVideoService.processShortVideo(
      file.buffer,
      file.originalname,
    );

    // Save compressed video
    const videoResult = await this.storageService.saveFile(
      `shorts/${sellerId}`,
      `${Date.now()}-compressed.mp4`,
      processed.compressedBuffer,
    );

    // Save thumbnail
    const thumbResult = await this.storageService.saveFile(
      `shorts/${sellerId}/thumbs`,
      `${Date.now()}-thumb.jpg`,
      processed.thumbnailBuffer,
    );

    // Determine expiry
    const isPaid = !!purchase;
    const durationDays = purchase
      ? purchase.duration
      : SHORTS_FREE_DURATION_DAYS;
    const expiresAt = new Date(Date.now() + daysToMs(durationDays));

    // Create short record
    const short = new this.shortVideoModel({
      sellerId: new Types.ObjectId(sellerId),
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId
        ? new Types.ObjectId(dto.categoryId)
        : undefined,
      categoryName: dto.categoryName,
      price: dto.price,
      currency: DEFAULT_CURRENCY,
      location: dto.location
        ? {
            provinceId: dto.location.provinceId
              ? new Types.ObjectId(dto.location.provinceId)
              : undefined,
            cityId: dto.location.cityId
              ? new Types.ObjectId(dto.location.cityId)
              : undefined,
            areaId: dto.location.areaId
              ? new Types.ObjectId(dto.location.areaId)
              : undefined,
            province: dto.location.province,
            city: dto.location.city,
            area: dto.location.area,
          }
        : undefined,
      video: {
        url: videoResult.fileUrl,
        thumbnailUrl: thumbResult.fileUrl,
        compressedUrl: videoResult.fileUrl,
        duration: processed.duration,
        originalSize: file.size,
        compressedSize: processed.compressedBuffer.length,
        width: processed.width,
        height: processed.height,
      },
      status: ShortVideoStatus.PENDING_REVIEW,
      expiresAt,
      isPaid,
      purchaseId: purchase?._id,
      linkedListingId: dto.linkedListingId
        ? new Types.ObjectId(dto.linkedListingId)
        : undefined,
    });

    await short.save();

    // Spend the short that was reserved by the check above.
    //
    // Conditional on there still being one left, so two uploads racing through
    // the (slow) video-processing window cannot both take the last unit. A bundle
    // keeps its balance per entitlement, hence the two shapes.
    if (purchase) {
      const spentFlat = await this.shortsPurchaseModel
        .updateOne(
          {
            _id: purchase._id,
            entitlements: { $size: 0 },
            remainingQuantity: { $gt: 0 },
          },
          { $inc: { remainingQuantity: -1 } },
        )
        .exec();

      if (spentFlat.modifiedCount === 0) {
        await this.shortsPurchaseModel
          .updateOne(
            {
              _id: purchase._id,
              entitlements: {
                $elemMatch: {
                  kind: EntitlementKind.SHORTS,
                  remaining: { $gt: 0 },
                },
              },
            },
            { $inc: { 'entitlements.$[slot].remaining': -1 } },
            {
              arrayFilters: [
                {
                  'slot.kind': EntitlementKind.SHORTS,
                  'slot.remaining': { $gt: 0 },
                },
              ],
            },
          )
          .exec();
      }
    }

    // Track event
    this.adminTrackerService
      .track(sellerId, UserAction.SHORT_UPLOADED, {
        shortId: short._id.toString(),
        isPaid,
        duration: processed.duration,
      })
      .catch((err) =>
        this.logger.warn(`Failed to track SHORT_UPLOADED: ${err.message}`),
      );

    return short;
  }

  async getShortById(id: string): Promise<ShortVideoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const short = await this.shortVideoModel
      .findById(id)
      .populate('sellerId', 'profile.firstName profile.lastName profile.avatar')
      .exec();
    if (!short || short.status === ShortVideoStatus.DELETED) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return short;
  }

  async getPublicFeed(
    page: number = 1,
    limit: number = 10,
    filters?: {
      search?: string;
      categoryId?: string;
      provinceId?: string;
      cityId?: string;
      areaId?: string;
      city?: string;
      seed?: string;
      seen?: string[]; // IDs already seen by the client
    },
  ): Promise<{
    data: ShortVideoDocument[];
    total: number;
    page: number;
    limit: number;
    seed: string;
  }> {
    const filter: Record<string, any> = { status: ShortVideoStatus.ACTIVE };

    if (filters?.categoryId) {
      filter.categoryId = new Types.ObjectId(filters.categoryId);
    }
    if (filters?.provinceId) {
      filter['location.provinceId'] = new Types.ObjectId(filters.provinceId);
    }
    if (filters?.cityId) {
      filter['location.cityId'] = new Types.ObjectId(filters.cityId);
    }
    if (filters?.areaId) {
      filter['location.areaId'] = new Types.ObjectId(filters.areaId);
    }
    if (filters?.city) {
      filter['location.city'] = { $regex: filters.city, $options: 'i' };
    }
    if (filters?.search) {
      filter.$text = { $search: filters.search };
    }

    // Exclude already-seen shorts
    if (filters?.seen && filters.seen.length > 0) {
      filter._id = { $nin: filters.seen.map((id) => new Types.ObjectId(id)) };
    }

    const total = await this.shortVideoModel
      .countDocuments({ status: ShortVideoStatus.ACTIVE })
      .exec();

    // Use a seed for consistent random ordering within a session
    const seed = filters?.seed || Math.random().toString(36).substring(2, 10);
    const seedNum = this.hashSeed(seed);

    // Use MongoDB $sample for random selection when no text search
    let data: ShortVideoDocument[];
    if (filters?.search) {
      data = await this.shortVideoModel
        .find(filter)
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .populate(
          'sellerId',
          'profile.firstName profile.lastName profile.avatar phone',
        )
        .populate('linkedListingId', 'title price images')
        .populate('categoryId', 'name slug')
        .exec();
    } else {
      // Use aggregation with $sample for true random
      const pipeline: any[] = [
        { $match: filter },
        { $sample: { size: limit } },
      ];

      const rawDocs = await this.shortVideoModel.aggregate(pipeline).exec();
      const ids = rawDocs.map((d: any) => d._id);

      // Re-fetch with populate
      data = await this.shortVideoModel
        .find({ _id: { $in: ids } })
        .populate(
          'sellerId',
          'profile.firstName profile.lastName profile.avatar phone',
        )
        .populate('linkedListingId', 'title price images')
        .populate('categoryId', 'name slug')
        .exec();
    }

    return { data, total, page, limit, seed };
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  async getSellerShorts(
    sellerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: ShortVideoDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const filter = {
      sellerId: new Types.ObjectId(sellerId),
      status: {
        $in: [ShortVideoStatus.ACTIVE, ShortVideoStatus.PENDING_REVIEW],
      },
    };

    const [data, total] = await Promise.all([
      this.shortVideoModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.shortVideoModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async getMyShorts(
    sellerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: ShortVideoDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const filter = {
      sellerId: new Types.ObjectId(sellerId),
      status: { $ne: ShortVideoStatus.DELETED },
    };

    const [data, total] = await Promise.all([
      this.shortVideoModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.shortVideoModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async deleteShort(id: string, sellerId: string): Promise<void> {
    const short = await this.shortVideoModel.findById(id).exec();
    if (!short) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (short.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
    short.status = ShortVideoStatus.DELETED;
    short.deletedAt = new Date();
    await short.save();
  }

  async updateShort(
    id: string,
    sellerId: string,
    dto: UpdateShortDto,
  ): Promise<ShortVideoDocument> {
    const short = await this.shortVideoModel.findById(id).exec();
    if (!short) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (short.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
    if (short.status === ShortVideoStatus.DELETED) {
      throw new BadRequestException(PUBLIC_ERROR.SHORT_ACTION_FAILED);
    }

    // Update fields
    if (dto.title !== undefined) short.title = dto.title;
    if (dto.description !== undefined) short.description = dto.description;
    if (dto.price !== undefined) short.price = dto.price;
    if (dto.categoryId !== undefined) {
      short.categoryId = dto.categoryId
        ? new Types.ObjectId(dto.categoryId)
        : undefined;
    }
    if (dto.categoryName !== undefined) short.categoryName = dto.categoryName;
    if (dto.location !== undefined) {
      short.location = {
        provinceId: dto.location.provinceId
          ? new Types.ObjectId(dto.location.provinceId)
          : undefined,
        cityId: dto.location.cityId
          ? new Types.ObjectId(dto.location.cityId)
          : undefined,
        areaId: dto.location.areaId
          ? new Types.ObjectId(dto.location.areaId)
          : undefined,
        province: dto.location.province,
        city: dto.location.city,
        area: dto.location.area,
      } as any;
    }
    if (dto.linkedListingId !== undefined) {
      short.linkedListingId = dto.linkedListingId
        ? new Types.ObjectId(dto.linkedListingId)
        : undefined;
    }

    // Send back to review
    short.status = ShortVideoStatus.PENDING_REVIEW;
    await short.save();

    // Notify about re-review
    this.adminTrackerService
      .track(sellerId, UserAction.SHORT_UPLOADED, {
        shortId: short._id.toString(),
        action: 'edited',
      })
      .catch((err) =>
        this.logger.warn(`Failed to track short edit: ${err.message}`),
      );

    return short;
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.shortVideoModel
      .updateOne(
        { _id: new Types.ObjectId(id), status: ShortVideoStatus.ACTIVE },
        { $inc: { viewCount: 1 } },
      )
      .exec();
  }

  async incrementFavoriteCount(id: string, increment: number): Promise<void> {
    await this.shortVideoModel
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $inc: { favoriteCount: increment } },
      )
      .exec();
  }

  async likeShort(
    shortId: string,
    userId: string,
  ): Promise<{ liked: boolean; favoriteCount: number }> {
    const existing = await this.shortLikeModel
      .findOne({
        userId: new Types.ObjectId(userId),
        shortId: new Types.ObjectId(shortId),
      })
      .exec();

    if (existing) {
      return {
        liked: true,
        favoriteCount: await this.getFavoriteCount(shortId),
      };
    }

    await this.shortLikeModel.create({
      userId: new Types.ObjectId(userId),
      shortId: new Types.ObjectId(shortId),
    });

    await this.shortVideoModel
      .updateOne(
        { _id: new Types.ObjectId(shortId) },
        { $inc: { favoriteCount: 1 } },
      )
      .exec();

    return { liked: true, favoriteCount: await this.getFavoriteCount(shortId) };
  }

  async unlikeShort(
    shortId: string,
    userId: string,
  ): Promise<{ liked: boolean; favoriteCount: number }> {
    const result = await this.shortLikeModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        shortId: new Types.ObjectId(shortId),
      })
      .exec();

    if (result.deletedCount > 0) {
      await this.shortVideoModel
        .updateOne(
          { _id: new Types.ObjectId(shortId) },
          { $inc: { favoriteCount: -1 } },
        )
        .exec();
    }

    return {
      liked: false,
      favoriteCount: await this.getFavoriteCount(shortId),
    };
  }

  private async getFavoriteCount(shortId: string): Promise<number> {
    const short = await this.shortVideoModel
      .findById(shortId)
      .select('favoriteCount')
      .exec();
    return short?.favoriteCount ?? 0;
  }

  async isLikedByUser(shortId: string, userId: string): Promise<boolean> {
    const like = await this.shortLikeModel
      .findOne({
        userId: new Types.ObjectId(userId),
        shortId: new Types.ObjectId(shortId),
      })
      .exec();
    return !!like;
  }

  async getUserLikedShortIds(
    userId: string,
    shortIds: string[],
  ): Promise<string[]> {
    const likes = await this.shortLikeModel
      .find({
        userId: new Types.ObjectId(userId),
        shortId: { $in: shortIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('shortId')
      .exec();
    return likes.map((l) => l.shortId.toString());
  }

  async getLikedShorts(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: ShortVideoDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const likes = await this.shortLikeModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const shortIds = likes.map((l) => l.shortId);
    const total = await this.shortLikeModel
      .countDocuments({ userId: new Types.ObjectId(userId) })
      .exec();

    const data = await this.shortVideoModel
      .find({
        _id: { $in: shortIds },
        status: { $ne: ShortVideoStatus.DELETED },
      })
      .populate('sellerId', 'profile.firstName profile.lastName profile.avatar')
      .exec();

    return { data, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async adminListShorts(query: ListShortsQueryDto): Promise<{
    data: ShortVideoDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.sellerId) {
      filter.sellerId = new Types.ObjectId(query.sellerId);
    }
    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo)
        filter.createdAt.$lte = new Date(query.dateTo + 'T23:59:59');
    }

    // Sorting
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort) {
      const dir = query.order === 'asc' ? 1 : -1;
      sortObj = { [query.sort]: dir };
    }

    const [data, total] = await Promise.all([
      this.shortVideoModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('sellerId', 'profile.firstName profile.lastName email phone')
        .exec(),
      this.shortVideoModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async adminApproveShort(id: string): Promise<ShortVideoDocument> {
    const short = await this.shortVideoModel.findById(id).exec();
    if (!short) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (short.status !== ShortVideoStatus.PENDING_REVIEW) {
      throw new BadRequestException(PUBLIC_ERROR.SHORT_ACTION_FAILED);
    }

    short.status = ShortVideoStatus.ACTIVE;
    await short.save();

    // Notify seller
    this.notificationsService
      .sendToUser(short.sellerId.toString(), NotificationType.PRODUCT_UPDATES, {
        title: 'Short Video Approved',
        body: 'Your short video has been approved and is now live!',
        data: { type: 'short_approved', shortId: short._id.toString() },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to send short approval notification: ${err.message}`,
        ),
      );

    this.adminTrackerService
      .track(short.sellerId.toString(), UserAction.SHORT_APPROVED, {
        shortId: short._id.toString(),
      })
      .catch((err) =>
        this.logger.warn(`Failed to track SHORT_APPROVED: ${err.message}`),
      );

    return short;
  }

  async adminRejectShort(
    id: string,
    reason: string,
  ): Promise<ShortVideoDocument> {
    const short = await this.shortVideoModel.findById(id).exec();
    if (!short) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (short.status !== ShortVideoStatus.PENDING_REVIEW) {
      throw new BadRequestException(PUBLIC_ERROR.SHORT_ACTION_FAILED);
    }

    short.status = ShortVideoStatus.REJECTED;
    short.rejectionReason = reason;
    short.rejectionCount += 1;
    await short.save();

    // Notify seller
    this.notificationsService
      .sendToUser(short.sellerId.toString(), NotificationType.PRODUCT_UPDATES, {
        title: 'Short Video Rejected',
        body: `Your short video was rejected: ${reason}`,
        data: { type: 'short_rejected', shortId: short._id.toString() },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to send short rejection notification: ${err.message}`,
        ),
      );

    this.adminTrackerService
      .track(short.sellerId.toString(), UserAction.SHORT_REJECTED, {
        shortId: short._id.toString(),
        reason,
      })
      .catch((err) =>
        this.logger.warn(`Failed to track SHORT_REJECTED: ${err.message}`),
      );

    return short;
  }

  async adminDeleteShort(id: string): Promise<void> {
    const short = await this.shortVideoModel.findById(id).exec();
    if (!short) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    short.status = ShortVideoStatus.DELETED;
    short.deletedAt = new Date();
    await short.save();
  }

  // ═══════════════════════════════════════════════════════════
  // PACKAGES
  // ═══════════════════════════════════════════════════════════

  async createPackage(
    dto: CreateShortsPackageDto,
  ): Promise<ShortsPackageDocument> {
    const pkg = new this.shortsPackageModel({
      name: dto.name,
      quantity: dto.quantity,
      duration: dto.duration,
      price: dto.price,
      isActive: dto.isActive ?? true,
      description: dto.description,
    });
    return pkg.save();
  }

  async updatePackage(
    id: string,
    dto: UpdateShortsPackageDto,
  ): Promise<ShortsPackageDocument> {
    const pkg = await this.shortsPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    Object.assign(pkg, dto);
    return pkg.save();
  }

  async getPackages(
    activeOnly: boolean = true,
  ): Promise<ShortsPackageDocument[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.shortsPackageModel.find(filter).sort({ price: 1 }).exec();
  }

  async purchasePackage(
    sellerId: string,
    dto: PurchaseShortsPackageDto,
  ): Promise<PackagePurchaseDocument> {
    const pkg = await this.shortsPackageModel.findById(dto.packageId).exec();
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const purchase = new this.shortsPurchaseModel({
      purchaseType: PurchaseType.SHORTS,
      sellerId: new Types.ObjectId(sellerId),
      packageId: pkg._id,
      quantity: pkg.quantity,
      remainingQuantity: pkg.quantity,
      duration: pkg.duration,
      price: pkg.price,
      currency: DEFAULT_CURRENCY,
      paymentMethod: dto.paymentMethod,
      paymentTransactionId: dto.transactionId,
      paymentStatus: PaymentStatus.PENDING,
      expiresAt: new Date(Date.now() + daysToMs(pkg.duration)),
    });

    await purchase.save();

    this.adminTrackerService
      .track(sellerId, UserAction.SHORTS_PACKAGE_PURCHASED, {
        purchaseId: purchase._id.toString(),
        packageName: pkg.name,
        amount: pkg.price,
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to track SHORTS_PACKAGE_PURCHASED: ${err.message}`,
        ),
      );

    return purchase;
  }

  async getMyPurchases(sellerId: string): Promise<PackagePurchaseDocument[]> {
    return this.shortsPurchaseModel
      .find({
        purchaseType: PurchaseType.SHORTS,
        sellerId: new Types.ObjectId(sellerId),
        paymentStatus: PaymentStatus.COMPLETED,
      })
      .populate('packageId', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  async confirmPayment(purchaseId: string): Promise<void> {
    const purchase = await this.shortsPurchaseModel.findById(purchaseId).exec();
    if (!purchase) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    purchase.paymentStatus = PaymentStatus.COMPLETED;
    await purchase.save();

    // Notify user
    this.notificationsService
      .sendToUser(
        purchase.sellerId.toString(),
        NotificationType.PACKAGE_ALERTS,
        {
          title: 'Shorts Package Activated',
          body: `Your shorts package has been activated. You can now upload ${purchase.quantity} shorts!`,
          data: {
            type: 'shorts_package_activated',
            purchaseId: purchase._id.toString(),
          },
        },
      )
      .catch((err) =>
        this.logger.warn(
          `Failed to send shorts package activation notification: ${err.message}`,
        ),
      );
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private validateShortFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    if (
      !(SHORTS_ALLOWED_MIMETYPES as readonly string[]).includes(file.mimetype)
    ) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    if (file.size > SHORTS_MAX_FILE_SIZE) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
  }

  private async checkCanPostShort(
    sellerId: string,
    purchaseId?: string,
  ): Promise<{
    canPost: boolean;
    reason?: string;
    purchase?: PackagePurchaseDocument;
  }> {
    // If a purchase ID is provided, validate it
    if (purchaseId) {
      const purchase = await this.shortsPurchaseModel
        .findById(purchaseId)
        .exec();
      if (!purchase) {
        return { canPost: false, reason: ERROR.PURCHASE_NOT_FOUND };
      }
      if (purchase.sellerId.toString() !== sellerId) {
        return { canPost: false, reason: ERROR.PACKAGE_OWN_ONLY };
      }
      if (purchase.paymentStatus !== PaymentStatus.COMPLETED) {
        return { canPost: false, reason: ERROR.PACKAGE_PAYMENT_NOT_COMPLETED };
      }
      // Reads the balance through the shared helper so a bundle — which tracks
      // shorts as one entitlement among several — counts just like a shorts-only
      // package. Checking `remainingQuantity` alone ignored bundles entirely.
      if (remainingOf(purchase, EntitlementKind.SHORTS) <= 0) {
        return {
          canPost: false,
          reason: ERROR.SHORT_PACKAGE_FULLY_USED,
        };
      }
      if (purchase.expiresAt && purchase.expiresAt < new Date()) {
        return { canPost: false, reason: ERROR.SHORT_PACKAGE_EXPIRED };
      }
      return { canPost: true, purchase };
    }

    // Check free shorts limit (monthly)
    const monthStart = startOfMonth();

    const monthlyCount = await this.shortVideoModel
      .countDocuments({
        sellerId: new Types.ObjectId(sellerId),
        isPaid: false,
        createdAt: { $gte: monthStart },
      })
      .exec();

    if (monthlyCount >= SHORTS_FREE_LIMIT) {
      return {
        canPost: false,
        reason: `You've used all ${SHORTS_FREE_LIMIT} free shorts this month. Purchase a shorts package to upload more.`,
      };
    }

    return { canPost: true };
  }

  async getShortsStats(sellerId: string): Promise<{
    totalShorts: number;
    activeShorts: number;
    pendingShorts: number;
    freeRemaining: number;
    freeUsedThisMonth: number;
    freeRemainingThisMonth: number;
    totalViews: number;
  }> {
    const sellerObjId = new Types.ObjectId(sellerId);

    const monthStart = startOfMonth();

    const [
      totalShorts,
      activeShorts,
      pendingShorts,
      freeUsedThisMonth,
      viewsAgg,
    ] = await Promise.all([
      this.shortVideoModel
        .countDocuments({
          sellerId: sellerObjId,
          status: { $ne: ShortVideoStatus.DELETED },
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          sellerId: sellerObjId,
          status: ShortVideoStatus.ACTIVE,
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          sellerId: sellerObjId,
          status: ShortVideoStatus.PENDING_REVIEW,
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          sellerId: sellerObjId,
          isPaid: false,
          createdAt: { $gte: monthStart },
        })
        .exec(),
      this.shortVideoModel
        .aggregate([
          {
            $match: { sellerId: sellerObjId, status: ShortVideoStatus.ACTIVE },
          },
          { $group: { _id: null, totalViews: { $sum: '$viewCount' } } },
        ])
        .exec(),
    ]);

    const freeRemainingThisMonth = Math.max(
      0,
      SHORTS_FREE_LIMIT - freeUsedThisMonth,
    );

    return {
      totalShorts,
      activeShorts,
      pendingShorts,
      freeRemaining: freeRemainingThisMonth,
      freeUsedThisMonth,
      freeRemainingThisMonth,
      totalViews: viewsAgg[0]?.totalViews ?? 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CRON JOBS
  // ═══════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredShorts(): Promise<number> {
    const now = new Date();
    const expiredShorts = await this.shortVideoModel
      .find({
        status: ShortVideoStatus.ACTIVE,
        expiresAt: { $lte: now },
      })
      .select('_id sellerId title')
      .exec();

    if (expiredShorts.length === 0) return 0;

    const ids = expiredShorts.map((s) => s._id);
    const result = await this.shortVideoModel.updateMany(
      { _id: { $in: ids } },
      { $set: { status: ShortVideoStatus.EXPIRED, updatedAt: now } },
    );

    for (const short of expiredShorts) {
      this.notificationsService
        .sendToUser(
          short.sellerId.toString(),
          NotificationType.PRODUCT_UPDATES,
          {
            title: 'Short Video Expired',
            body: `Your short video "${short.title || 'Untitled'}" has expired.`,
            data: { type: 'short_expired', shortId: short._id.toString() },
          },
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send short expiry notification: ${err.message}`,
          ),
        );

      this.adminTrackerService
        .track(short.sellerId.toString(), UserAction.SHORT_EXPIRED, {
          shortId: short._id.toString(),
        })
        .catch((err) =>
          this.logger.warn(`Failed to track SHORT_EXPIRED: ${err.message}`),
        );
    }

    this.logger.log(`Expired ${result.modifiedCount} shorts`);
    return result.modifiedCount;
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendShortsExpiryReminders(): Promise<number> {
    let sent = 0;
    const now = new Date();

    for (const days of SHORTS_EXPIRY_REMINDER_DAYS) {
      const windowStart = new Date(now.getTime() + daysToMs(days - 1));
      const windowEnd = new Date(now.getTime() + daysToMs(days));

      const shorts = await this.shortVideoModel
        .find({
          status: ShortVideoStatus.ACTIVE,
          expiresAt: { $gt: windowStart, $lte: windowEnd },
        })
        .select('_id sellerId title')
        .exec();

      for (const short of shorts) {
        this.notificationsService
          .sendToUser(
            short.sellerId.toString(),
            NotificationType.PRODUCT_UPDATES,
            {
              title: 'Short Video Expiring Soon',
              body: `Your short "${short.title || 'Untitled'}" will expire in ${days} day(s). Purchase a package to extend.`,
              data: {
                type: 'short_expiry_reminder',
                shortId: short._id.toString(),
                daysLeft: String(days),
              },
            },
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to send short expiry reminder: ${err.message}`,
            ),
          );
        sent++;
      }
    }

    if (sent > 0) {
      this.logger.log(`Sent ${sent} short expiry reminders`);
    }
    return sent;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupDeletedShorts(): Promise<number> {
    // Permanently remove shorts deleted more than 30 days ago
    const cutoff = new Date(Date.now() - daysToMs(30));
    const toDelete = await this.shortVideoModel
      .find({
        status: ShortVideoStatus.DELETED,
        deletedAt: { $lte: cutoff },
      })
      .select('_id video')
      .exec();

    if (toDelete.length === 0) return 0;

    // Delete files from storage
    for (const short of toDelete) {
      if (short.video?.url) {
        const key = this.extractStorageKey(short.video.url);
        if (key) {
          this.storageService
            .deleteFile(key)
            .catch((err) =>
              this.logger.warn(
                `Failed to delete short video file: ${err.message}`,
              ),
            );
        }
      }
      if (short.video?.thumbnailUrl) {
        const key = this.extractStorageKey(short.video.thumbnailUrl);
        if (key) {
          this.storageService
            .deleteFile(key)
            .catch((err) =>
              this.logger.warn(
                `Failed to delete short thumbnail: ${err.message}`,
              ),
            );
        }
      }
    }

    const ids = toDelete.map((s) => s._id);
    const result = await this.shortVideoModel.deleteMany({
      _id: { $in: ids },
    });

    this.logger.log(
      `Permanently deleted ${result.deletedCount} old deleted shorts`,
    );
    return result.deletedCount;
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiredShortsPurchases(): Promise<number> {
    const now = new Date();
    const expired = await this.shortsPurchaseModel
      .find({
        purchaseType: PurchaseType.SHORTS,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $lte: now },
        remainingQuantity: { $gte: 0 },
      })
      .populate('packageId', 'name')
      .exec();

    let processed = 0;
    for (const purchase of expired) {
      // Mark as processed
      await this.shortsPurchaseModel
        .updateOne({ _id: purchase._id }, { $set: { remainingQuantity: -1 } })
        .exec();

      const pkgName = (purchase.packageId as any)?.name ?? 'Shorts package';

      this.notificationsService
        .sendToUser(
          purchase.sellerId.toString(),
          NotificationType.PACKAGE_ALERTS,
          {
            title: 'Shorts Package Expired',
            body: `Your "${pkgName}" has expired. ${purchase.remainingQuantity} unused shorts were lost.`,
            data: {
              type: 'shorts_package_expired',
              purchaseId: purchase._id.toString(),
            },
          },
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to send shorts package expiry notification: ${err.message}`,
          ),
        );

      processed++;
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} expired shorts purchases`);
    }
    return processed;
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════

  async getAnalytics(dateFrom?: string, dateTo?: string): Promise<any> {
    const dateFilter: Record<string, any> = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    const createdAtFilter =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [
      totalShorts,
      activeShorts,
      pendingShorts,
      rejectedShorts,
      expiredShorts,
      deletedShorts,
      totalViews,
      totalLikes,
      topViewed,
      topLiked,
      uploadsByDay,
      categoryBreakdown,
      cityBreakdown,
    ] = await Promise.all([
      this.shortVideoModel.countDocuments({ ...createdAtFilter }).exec(),
      this.shortVideoModel
        .countDocuments({ status: ShortVideoStatus.ACTIVE, ...createdAtFilter })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          status: ShortVideoStatus.PENDING_REVIEW,
          ...createdAtFilter,
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          status: ShortVideoStatus.REJECTED,
          ...createdAtFilter,
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          status: ShortVideoStatus.EXPIRED,
          ...createdAtFilter,
        })
        .exec(),
      this.shortVideoModel
        .countDocuments({
          status: ShortVideoStatus.DELETED,
          ...createdAtFilter,
        })
        .exec(),
      this.shortVideoModel
        .aggregate([
          { $match: { status: ShortVideoStatus.ACTIVE } },
          { $group: { _id: null, total: { $sum: '$viewCount' } } },
        ])
        .exec()
        .then((r) => r[0]?.total ?? 0),
      this.shortVideoModel
        .aggregate([
          { $match: { status: ShortVideoStatus.ACTIVE } },
          { $group: { _id: null, total: { $sum: '$favoriteCount' } } },
        ])
        .exec()
        .then((r) => r[0]?.total ?? 0),
      this.shortVideoModel
        .find({ status: ShortVideoStatus.ACTIVE })
        .sort({ viewCount: -1 })
        .limit(10)
        .select('title viewCount favoriteCount sellerId createdAt')
        .populate('sellerId', 'profile.firstName profile.lastName')
        .exec(),
      this.shortVideoModel
        .find({ status: ShortVideoStatus.ACTIVE })
        .sort({ favoriteCount: -1 })
        .limit(10)
        .select('title viewCount favoriteCount sellerId createdAt')
        .populate('sellerId', 'profile.firstName profile.lastName')
        .exec(),
      this.shortVideoModel
        .aggregate([
          { $match: createdAtFilter },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 30 },
        ])
        .exec(),
      this.shortVideoModel
        .aggregate([
          { $match: { categoryName: { $ne: null }, ...createdAtFilter } },
          {
            $group: {
              _id: '$categoryName',
              count: { $sum: 1 },
              views: { $sum: '$viewCount' },
              likes: { $sum: '$favoriteCount' },
            },
          },
          { $sort: { count: -1 } },
        ])
        .exec(),
      this.shortVideoModel
        .aggregate([
          { $match: { 'location.city': { $ne: null }, ...createdAtFilter } },
          {
            $group: {
              _id: '$location.city',
              count: { $sum: 1 },
              views: { $sum: '$viewCount' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .exec(),
    ]);

    return {
      overview: {
        totalShorts,
        activeShorts,
        pendingShorts,
        rejectedShorts,
        expiredShorts,
        deletedShorts,
        totalViews,
        totalLikes,
      },
      topViewed,
      topLiked,
      uploadsByDay,
      categoryBreakdown,
      cityBreakdown,
    };
  }

  private extractStorageKey(url: string): string | null {
    try {
      const match = url.match(/\/uploads\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
