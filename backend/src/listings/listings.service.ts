import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from './schemas/product-listing.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  Category,
  CategoryDocument,
  AttributeType,
} from '../categories/schemas/category.schema.js';
import {
  Conversation,
  ConversationDocument,
} from '../messaging/schemas/conversation.schema.js';
import {
  Message,
  MessageDocument,
} from '../messaging/schemas/message.schema.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { AllowedStatusTransition } from './dto/update-status.dto.js';
import { SearchSyncService } from '../search/search-sync.service.js';

export interface PaginatedListings {
  data: ProductListingDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly searchSyncService: SearchSyncService,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
    sort: string = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    sellerId?: string,
    filters?: {
      categoryId?: string;
      provinceId?: string;
      cityId?: string;
      areaId?: string;
      province?: string;
      city?: string;
      area?: string;
    },
  ): Promise<PaginatedListings> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const filter: Record<string, any> = sellerId
      ? {
          sellerId: new Types.ObjectId(sellerId),
          deletedAt: { $exists: false },
        }
      : { status: ListingStatus.ACTIVE, deletedAt: { $exists: false } };

    if (filters?.categoryId) {
      if (Types.ObjectId.isValid(filters.categoryId)) {
        filter.categoryPath = new Types.ObjectId(filters.categoryId);
      } else {
        filter.categoryPath = filters.categoryId;
      }
    }
    if (filters?.provinceId) {
      filter['location.provinceId'] = new Types.ObjectId(filters.provinceId);
    } else if (filters?.province) {
      filter['location.province'] = {
        $regex: new RegExp(`^${filters.province}$`, 'i'),
      };
    }
    if (filters?.cityId) {
      filter['location.cityId'] = new Types.ObjectId(filters.cityId);
    } else if (filters?.city) {
      filter['location.city'] = {
        $regex: new RegExp(`^${filters.city}$`, 'i'),
      };
    }
    if (filters?.areaId) {
      filter['location.areaId'] = new Types.ObjectId(filters.areaId);
    } else if (filters?.area) {
      filter['location.area'] = {
        $regex: new RegExp(`^${filters.area}$`, 'i'),
      };
    }

    const sortObj: Record<string, 1 | -1> = {
      isFeatured: -1,
      [sort]: order === 'asc' ? 1 : -1,
    };
    const [data, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getFeaturedAds(
    options: {
      categoryId?: string;
      provinceId?: string;
      cityId?: string;
      areaId?: string;
      city?: string;
      limit?: number;
    } = {},
  ): Promise<ProductListingDocument[]> {
    const limit = Math.min(options.limit ?? 20, 20);
    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      isFeatured: true,
      featuredUntil: { $gt: new Date() },
      deletedAt: { $exists: false },
    };

    if (options.categoryId) {
      filter.categoryPath = Types.ObjectId.isValid(options.categoryId)
        ? new Types.ObjectId(options.categoryId)
        : options.categoryId;
    }
    if (options.provinceId) {
      filter['location.provinceId'] = new Types.ObjectId(options.provinceId);
    }
    if (options.cityId) {
      filter['location.cityId'] = new Types.ObjectId(options.cityId);
    } else if (options.city) {
      filter['location.city'] = {
        $regex: new RegExp(`^${options.city}$`, 'i'),
      };
    }
    if (options.areaId) {
      filter['location.areaId'] = new Types.ObjectId(options.areaId);
    }

    const pipeline: any[] = [{ $match: filter }, { $sample: { size: limit } }];

    return this.listingModel.aggregate(pipeline).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Listing not found');
    }
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  async findByIdAndIncrementViews(
    id: string,
    requesterId?: string,
    requesterRole?: string,
  ): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Listing not found');
    }
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Deleted listings are never visible
    if (listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    // Only active/sold listings are publicly visible
    // Seller can see their own listings in any non-deleted status, admin can see all
    const isOwner = requesterId && listing.sellerId.toString() === requesterId;
    const isAdmin = requesterRole === 'admin';
    if (
      listing.status !== ListingStatus.ACTIVE &&
      listing.status !== ListingStatus.SOLD &&
      !isOwner &&
      !isAdmin
    ) {
      throw new NotFoundException('Listing not found');
    }

    // Increment views only for active listings
    if (listing.status === ListingStatus.ACTIVE) {
      await this.listingModel
        .updateOne({ _id: listing._id }, { $inc: { viewCount: 1 } })
        .exec();
      listing.viewCount += 1;
    }

    return listing;
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateListingDto,
  ): Promise<ProductListingDocument> {
    this.validateNoPhoneNumbers(dto.title ?? '', dto.description ?? '');
    const listing = await this.findById(id);
    this.assertOwnership(listing, sellerId);
    if (listing.status === ListingStatus.DELETED) {
      throw new BadRequestException('Cannot update a deleted listing');
    }
    const updateFields: Record<string, any> = {};
    if (dto.title !== undefined) updateFields.title = dto.title;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.condition !== undefined) updateFields.condition = dto.condition;
    if (dto.categoryAttributes !== undefined) {
      updateFields.categoryAttributes = new Map(
        Object.entries(dto.categoryAttributes),
      );
    }
    if (dto.price !== undefined) {
      updateFields.price = {
        amount: dto.price.amount,
        currency: dto.price.currency ?? 'PKR',
      };
    }
    if (dto.images !== undefined) {
      updateFields.images = dto.images.map((img, idx) => ({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        sortOrder: img.sortOrder ?? idx,
      }));
    }
    if (dto.video !== undefined) {
      updateFields.video = {
        url: dto.video.url,
        thumbnailUrl: dto.video.thumbnailUrl,
      };
    }
    if (dto.location !== undefined) {
      updateFields.location = {
        type: 'Point',
        coordinates: dto.location.coordinates,
        city: dto.location.city,
        area: dto.location.area,
      };
    }
    if (dto.contactInfo !== undefined) {
      updateFields.contactInfo = {
        phone: dto.contactInfo.phone,
        email: dto.contactInfo.email,
      };
    }
    if (dto.categoryId !== undefined)
      updateFields.categoryId = new Types.ObjectId(dto.categoryId);
    if (dto.categoryPath !== undefined)
      updateFields.categoryPath = dto.categoryPath.map(
        (id) => new Types.ObjectId(id),
      );
    if (dto.selectedFeatures !== undefined)
      updateFields.selectedFeatures = dto.selectedFeatures;
    updateFields.updatedAt = new Date();

    // If listing was rejected, auto-resubmit for review and clear rejection data
    if (listing.status === ListingStatus.REJECTED) {
      const rejCount = (listing as any).rejectionCount || 0;
      if (rejCount >= 3) {
        throw new BadRequestException(
          'This listing has reached the maximum number of review attempts. Unfortunately, it cannot be resubmitted. You may delete it and create a new listing.',
        );
      }
      updateFields.status = ListingStatus.PENDING_REVIEW;
      updateFields.rejectionReason = undefined;
      updateFields.rejectionReasonIds = [];
      updateFields.rejectionNote = undefined;
      updateFields.rejectedAt = undefined;
    }

    const updated = await this.listingModel
      .findByIdAndUpdate(id, { $set: updateFields }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Listing not found');
    }
    this.syncToEs(updated);
    return updated;
  }

  async updateStatus(
    id: string,
    sellerId: string,
    status: AllowedStatusTransition,
  ): Promise<ProductListingDocument> {
    const listing = await this.findById(id);
    this.assertOwnership(listing, sellerId);
    if (listing.status === ListingStatus.DELETED) {
      throw new BadRequestException(
        'Cannot update status of a deleted listing',
      );
    }
    const updated = await this.listingModel
      .findByIdAndUpdate(
        id,
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Listing not found');
    }
    this.syncToEs(updated);
    return updated;
  }

  async softDelete(
    id: string,
    userId: string,
    userRole: string,
    deletionReason?: string,
  ): Promise<ProductListingDocument> {
    const listing = await this.findById(id);
    const isOwner = listing.sellerId.toString() === userId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to delete this listing',
      );
    }
    if (listing.status === ListingStatus.DELETED) {
      throw new BadRequestException('Listing is already deleted');
    }
    const updateData: Record<string, any> = {
      status: ListingStatus.DELETED,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    if (deletionReason) updateData.deletionReason = deletionReason;
    const updated = await this.listingModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Listing not found');
    }
    await this.userModel
      .updateOne({ _id: listing.sellerId }, { $inc: { activeAdCount: -1 } })
      .exec();
    this.removeFromEs(id);
    return updated;
  }

  async resubmitForReview(
    id: string,
    sellerId: string,
  ): Promise<ProductListingDocument> {
    const listing = await this.findById(id);
    this.assertOwnership(listing, sellerId);
    if (listing.status !== ListingStatus.REJECTED) {
      throw new BadRequestException(
        'Only rejected listings can be resubmitted for review',
      );
    }
    const rejCount = (listing as any).rejectionCount || 0;
    if (rejCount >= 3) {
      throw new BadRequestException(
        'This listing has reached the maximum number of review attempts. Unfortunately, it cannot be resubmitted. You may delete it and create a new listing.',
      );
    }
    const updated = await this.listingModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: ListingStatus.PENDING_REVIEW,
            updatedAt: new Date(),
          },
          $unset: {
            rejectionReason: '',
            rejectionReasonIds: '',
            rejectionNote: '',
            rejectedAt: '',
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Listing not found');
    }
    return updated;
  }

  async create(
    sellerId: string,
    dto: CreateListingDto,
    moderationEnabled = false,
  ): Promise<ProductListingDocument> {
    this.validateNoPhoneNumbers(dto.title, dto.description);
    if (!Types.ObjectId.isValid(dto.categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }
    const category = await this.categoryModel.findById(dto.categoryId).exec();
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    this.validateCategoryAttributes(dto.categoryAttributes ?? {}, category);
    const categoryPath = await this.buildCategoryPath(category);
    const seller = await this.userModel.findById(sellerId).exec();
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    if (seller.activeAdCount >= seller.adLimit) {
      throw new ForbiddenException(
        'You have reached your free ad limit. Please purchase an ad package to post more ads.',
      );
    }
    if (!seller.phone || !seller.phoneVerified) {
      throw new ForbiddenException(
        'A verified phone number is required to post ads. Please add and verify your phone number.',
      );
    }
    const status = moderationEnabled
      ? ListingStatus.PENDING_REVIEW
      : ListingStatus.ACTIVE;
    const listing = new this.listingModel({
      sellerId: new Types.ObjectId(sellerId),
      title: dto.title,
      description: dto.description,
      price: {
        amount: dto.price.amount,
        currency: dto.price.currency ?? 'PKR',
      },
      categoryId: new Types.ObjectId(dto.categoryId),
      categoryPath,
      condition: dto.condition,
      categoryAttributes: dto.categoryAttributes
        ? new Map(Object.entries(dto.categoryAttributes))
        : new Map(),
      images: (dto.images ?? []).map((img, idx) => ({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        sortOrder: img.sortOrder ?? idx,
      })),
      video: dto.video
        ? { url: dto.video.url, thumbnailUrl: dto.video.thumbnailUrl }
        : undefined,
      location:
        dto.location.coordinates?.length === 2
          ? {
              type: 'Point',
              coordinates: dto.location.coordinates,
              city: dto.location.city,
              area: dto.location.area,
            }
          : ({ city: dto.location.city, area: dto.location.area } as any),
      contactInfo: {
        phone: dto.contactInfo?.phone || seller.phone || '',
        email: dto.contactInfo?.email || seller.email || '',
      },
      status,
    });
    const saved = await listing.save();
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(sellerId) },
        { $inc: { activeAdCount: 1 } },
      )
      .exec();
    this.syncToEs(saved);
    return saved;
  }

  private async syncToEs(listing: ProductListingDocument): Promise<void> {
    try {
      await this.searchSyncService.indexListing(listing);
    } catch (err) {
      this.logger.warn(
        `Failed to sync listing ${listing._id} to ES: ${(err as Error).message}`,
      );
    }
  }

  private async removeFromEs(listingId: string): Promise<void> {
    try {
      await this.searchSyncService.removeListing(listingId);
    } catch (err) {
      this.logger.warn(
        `Failed to remove listing ${listingId} from ES: ${(err as Error).message}`,
      );
    }
  }

  async getSellerVerification(sellerId: string): Promise<{
    emailVerified: boolean;
    phoneVerified: boolean;
    idVerified: boolean;
    activeAdsCount: number;
    responseRate: number;
    avgResponseTime: string;
  }> {
    const sellerObjId = new Types.ObjectId(sellerId);
    const [user, activeAdsCount, conversations] = await Promise.all([
      this.userModel
        .findById(sellerId)
        .select('emailVerified phoneVerified idVerified')
        .lean()
        .exec(),
      this.listingModel
        .countDocuments({ sellerId: sellerObjId, status: ListingStatus.ACTIVE })
        .exec(),
      this.conversationModel
        .find({ sellerId: sellerObjId })
        .select('_id')
        .lean()
        .exec(),
    ]);

    let respondedCount = 0;
    let totalResponseMs = 0;

    if (conversations.length > 0) {
      const convIds = conversations.map((c) => c._id);
      const results = await this.messageModel.aggregate([
        { $match: { conversationId: { $in: convIds } } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$conversationId',
            messages: {
              $push: { senderId: '$senderId', createdAt: '$createdAt' },
            },
          },
        },
      ]);

      for (const conv of results) {
        const msgs = conv.messages;
        if (msgs.length < 2) continue;
        const firstMsg = msgs[0];
        const sellerReply = msgs.find(
          (m: any) => m.senderId.toString() === sellerId,
        );
        if (sellerReply) {
          respondedCount++;
          const diff =
            new Date(sellerReply.createdAt).getTime() -
            new Date(firstMsg.createdAt).getTime();
          if (diff > 0) totalResponseMs += diff;
        }
      }
    }

    const totalConvs = conversations.length || 1;
    const responseRate = Math.round((respondedCount / totalConvs) * 100);
    const avgMs = respondedCount > 0 ? totalResponseMs / respondedCount : 0;
    let avgResponseTime = 'N/A';
    if (avgMs > 0) {
      const mins = Math.round(avgMs / 60000);
      if (mins < 60) avgResponseTime = `${mins} min`;
      else if (mins < 1440) avgResponseTime = `${Math.round(mins / 60)} hr`;
      else avgResponseTime = `${Math.round(mins / 1440)} days`;
    }

    return {
      emailVerified: user?.emailVerified ?? false,
      phoneVerified: user?.phoneVerified ?? false,
      idVerified: (user as any)?.idVerified ?? false,
      activeAdsCount,
      responseRate,
      avgResponseTime,
    };
  }

  private assertOwnership(
    listing: ProductListingDocument,
    sellerId: string,
  ): void {
    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(
        'You are not authorized to modify this listing',
      );
    }
  }

  private validateCategoryAttributes(
    attributes: Record<string, any>,
    category: CategoryDocument,
  ): void {
    const definitions = category.attributes ?? [];
    for (const def of definitions) {
      const value = attributes[def.key];
      if (
        def.required &&
        (value === undefined || value === null || value === '')
      ) {
        throw new BadRequestException(
          `Category attribute "${def.name}" is required`,
        );
      }
      if (value === undefined || value === null) continue;
      switch (def.type) {
        case AttributeType.TEXT:
          if (typeof value !== 'string')
            throw new BadRequestException(
              `Category attribute "${def.name}" must be a string`,
            );
          break;
        case AttributeType.NUMBER:
          if (typeof value !== 'number')
            throw new BadRequestException(
              `Category attribute "${def.name}" must be a number`,
            );
          break;
        case AttributeType.BOOLEAN:
          if (typeof value !== 'boolean')
            throw new BadRequestException(
              `Category attribute "${def.name}" must be a boolean`,
            );
          break;
        case AttributeType.SELECT:
          if (
            def.options &&
            def.options.length > 0 &&
            !def.options.includes(value)
          ) {
            throw new BadRequestException(
              `Category attribute "${def.name}" must be one of: ${def.options.join(', ')}`,
            );
          }
          break;
        case AttributeType.MULTISELECT:
          if (!Array.isArray(value))
            throw new BadRequestException(
              `Category attribute "${def.name}" must be an array`,
            );
          if (def.options && def.options.length > 0) {
            for (const v of value) {
              if (!def.options.includes(v)) {
                throw new BadRequestException(
                  `Category attribute "${def.name}" contains invalid option: ${v}`,
                );
              }
            }
          }
          break;
      }
    }
  }

  private async buildCategoryPath(
    category: CategoryDocument,
  ): Promise<Types.ObjectId[]> {
    const path: Types.ObjectId[] = [];
    let current: CategoryDocument | null = category;
    while (current) {
      path.unshift(current._id);
      if (current.parentId) {
        current = await this.categoryModel.findById(current.parentId).exec();
      } else {
        current = null;
      }
    }
    return path;
  }

  private validateNoPhoneNumbers(title: string, description: string): void {
    const check = (text: string, field: string) => {
      if (!text) return;
      // Strategy 1: Normalize spaces/dashes between digits
      const normalized = text.replace(/(\d)[\s\-\.]+(\d)/g, '$1$2');
      const patterns = [
        /\b0[3][0-9]{9}\b/,
        /\b0[2-9][0-9]{8,9}\b/,
        /\+92[\s\-]?[0-9]{10}\b/,
        /0092[\s\-]?[0-9]{10}\b/,
      ];
      if (patterns.some((p) => p.test(normalized))) {
        throw new BadRequestException(
          `Phone numbers are not allowed in the ${field}. Buyers will contact you through the app.`,
        );
      }

      // Strategy 2: Strip ALL non-digits, scan for Pakistani mobile patterns
      const digits = text.replace(/\D/g, '');
      const digitPatterns = [
        /0[3][0-9]{9}/, // 03xxxxxxxxx
        /920[3][0-9]{9}/, // 9203xxxxxxxxx
        /00920[3][0-9]{9}/, // 009203xxxxxxxxx
      ];
      if (digitPatterns.some((p) => p.test(digits))) {
        throw new BadRequestException(
          `Phone numbers are not allowed in the ${field}. Buyers will contact you through the app.`,
        );
      }
    };
    check(title, 'title');
    check(description, 'description');
  }
}
