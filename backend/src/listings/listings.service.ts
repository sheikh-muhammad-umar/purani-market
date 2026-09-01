import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { clientContext } from '../common/utils/request-context.js';
import {
  DEFAULT_CURRENCY,
  VIEW_DEDUP_PREFIX,
  VIEW_DEDUP_WINDOW_SECONDS,
  SEO_SELLER_FALLBACK_NAME,
} from '../common/constants/index.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { exactMatchRegex } from '../common/utils/sanitize-regex.js';
import { UserRole, isAdminRole } from '../common/enums/user-role.enum.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from './schemas/product-listing.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  Category,
  CategoryAttribute,
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
import { BrandsService } from '../brands/brands.service.js';
import { VehicleBrandService } from '../brands/vehicle-brand.service.js';
import { VehicleModelService } from '../brands/vehicle-model.service.js';
import { VehicleVariantService } from '../brands/vehicle-variant.service.js';
import { PackagesService } from '../packages/packages.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { AdPackageType } from '../packages/schemas/ad-package.schema.js';
import { OTHER_OPTION_ID, LISTING_PUBLIC_SELECT } from './constants/index.js';
import { PaginatedListings } from './interfaces/paginated-listings.interface.js';
import { daysToMs } from '../common/utils/time.js';

export type { PaginatedListings };

/**
 * The one definition of a verified seller: email, phone and ID all confirmed.
 *
 * Exported and shared so the rule cannot drift between the place a listing is
 * created and the place its badge is refreshed. It was previously written out by
 * hand in both, plus a third time in scripts/backfill-seller-verified.js.
 */
export function isSellerVerified(
  user:
    | {
        emailVerified?: boolean;
        phoneVerified?: boolean;
        idVerified?: boolean;
      }
    | null
    | undefined,
): boolean {
  return !!user?.emailVerified && !!user?.phoneVerified && !!user?.idVerified;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);
  private readonly activeDays: number;

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
    @InjectRedis() private readonly redis: Redis,
    private readonly brandsService: BrandsService,
    private readonly vehicleBrandService: VehicleBrandService,
    private readonly vehicleModelService: VehicleModelService,
    private readonly vehicleVariantService: VehicleVariantService,
    @Inject(forwardRef(() => PackagesService))
    private readonly packagesService: PackagesService,
    private readonly adminTrackerService: AdminTrackerService,
    private readonly configService: ConfigService,
  ) {
    this.activeDays = this.configService.get<number>('listing.activeDays')!;
  }

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
    /**
     * Include statuses other than active. Only ever true for a seller looking at
     * their own listings — never for a public request, which would otherwise
     * expose unpublished and rejected items.
     */
    includeAllStatuses = false,
  ): Promise<PaginatedListings> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const filter: Record<string, any> = { deletedAt: { $exists: false } };

    if (sellerId) {
      if (!Types.ObjectId.isValid(sellerId)) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      filter.sellerId = new Types.ObjectId(sellerId);
    }

    // Status visibility is its own decision, not a side effect of naming a
    // seller. It used to be the latter: passing a sellerId dropped the status
    // filter altogether, which was right for owners viewing their own listings
    // and wrong for everyone else, since a public seller profile would then show
    // drafts, listings awaiting moderation and rejected ones.
    if (!includeAllStatuses) {
      filter.status = ListingStatus.ACTIVE;
    }

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
      filter['location.province'] = exactMatchRegex(filters.province);
    }
    if (filters?.cityId) {
      filter['location.cityId'] = new Types.ObjectId(filters.cityId);
    } else if (filters?.city) {
      filter['location.city'] = exactMatchRegex(filters.city);
    }
    if (filters?.areaId) {
      filter['location.areaId'] = new Types.ObjectId(filters.areaId);
    } else if (filters?.area) {
      filter['location.area'] = exactMatchRegex(filters.area);
    }

    const sortObj: Record<string, 1 | -1> = {
      isFeatured: -1,
      [sort]: order === 'asc' ? 1 : -1,
    };
    const [data, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .select(LISTING_PUBLIC_SELECT)
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
      filter['location.city'] = exactMatchRegex(options.city);
    }
    if (options.areaId) {
      filter['location.areaId'] = new Types.ObjectId(options.areaId);
    }

    const pipeline: any[] = [
      { $match: filter },
      { $sample: { size: limit } },
      {
        $project: {
          purchaseId: 0,
          rejectionReasonIds: 0,
          rejectionNote: 0,
          rejectedAt: 0,
          deactivatedAt: 0,
          deletionReason: 0,
          __v: 0,
        },
      },
    ];

    return this.listingModel.aggregate(pipeline).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return listing;
  }

  private static readonly VIEW_WINDOW_SECONDS = VIEW_DEDUP_WINDOW_SECONDS; // 30 minutes

  async findByIdAndIncrementViews(
    id: string,
    requesterId?: string,
    requesterRole?: string,
    req?: any,
  ): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Deleted listings are never visible
    if (listing.status === ListingStatus.DELETED) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Only active/sold listings are publicly visible
    // Seller can see their own listings in any non-deleted status, admin can see all
    const isOwner = requesterId && listing.sellerId.toString() === requesterId;
    const isAdmin = isAdminRole(requesterRole);
    if (
      listing.status !== ListingStatus.ACTIVE &&
      listing.status !== ListingStatus.SOLD &&
      !isOwner &&
      !isAdmin
    ) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Increment views only for active listings, deduplicated per visitor
    if (listing.status === ListingStatus.ACTIVE && !isOwner && !isAdmin) {
      const visitorId = this.getVisitorId(requesterId, req);
      const viewKey = `${VIEW_DEDUP_PREFIX}:${id}:${visitorId}`;

      try {
        // SET NX = only set if key doesn't exist, EX = expire after window
        const isNew = await this.redis.set(
          viewKey,
          '1',
          'EX',
          ListingsService.VIEW_WINDOW_SECONDS,
          'NX',
        );

        if (isNew) {
          await this.listingModel
            .updateOne({ _id: listing._id }, { $inc: { viewCount: 1 } })
            .exec();
          listing.viewCount += 1;
        }
      } catch (err) {
        // Redis failure shouldn't break the page — fall through without incrementing
        this.logger.warn(
          `View dedup failed for ${id}: ${(err as Error).message}`,
        );
      }
    }

    return listing;
  }

  private getVisitorId(userId?: string, req?: any): string {
    // Logged-in user: use their ID
    if (userId) return `u:${userId}`;

    // Anonymous: hash IP + user-agent for a fingerprint
    const { ip = 'unknown', userAgent: ua = 'unknown' } = clientContext(req);
    const hash = createHash('sha256')
      .update(`${ip}:${ua}`)
      .digest('hex')
      .slice(0, 16);
    return `a:${hash}`;
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
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
    }

    // Edits bypassed attribute validation entirely, so a listing that passed on
    // create could be updated to any shape afterwards.
    if (
      dto.categoryAttributes !== undefined ||
      dto.selectedFeatures !== undefined ||
      dto.categoryId !== undefined
    ) {
      const effectiveCategoryId =
        dto.categoryId ?? listing.categoryId?.toString();
      if (
        !effectiveCategoryId ||
        !Types.ObjectId.isValid(effectiveCategoryId)
      ) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      const category = await this.categoryModel
        .findById(effectiveCategoryId)
        .exec();
      if (!category) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      // When the category moves but attributes are not resent, the attributes
      // already on the listing must still satisfy the new category.
      const attributesToCheck =
        dto.categoryAttributes ??
        (dto.categoryId !== undefined
          ? this.toPlainAttributes(listing.categoryAttributes)
          : undefined);
      if (attributesToCheck !== undefined) {
        this.validateCategoryAttributes(
          attributesToCheck,
          await this.resolveInheritedAttributes(category),
        );
      }
      if (dto.selectedFeatures !== undefined) {
        this.validateSelectedFeatures(
          dto.selectedFeatures,
          await this.resolveInheritedFeatures(category),
        );
      }
    }

    const updateFields: Record<string, any> = {};
    if (dto.title !== undefined) updateFields.title = dto.title;
    if (dto.description !== undefined)
      updateFields.description = dto.description;
    if (dto.condition !== undefined) updateFields.condition = dto.condition;
    if (dto.brandId !== undefined)
      updateFields.brandId = dto.brandId
        ? new Types.ObjectId(dto.brandId)
        : undefined;
    if (dto.brandName !== undefined) updateFields.brandName = dto.brandName;
    if (dto.vehicleBrandId !== undefined)
      updateFields.vehicleBrandId = dto.vehicleBrandId
        ? new Types.ObjectId(dto.vehicleBrandId)
        : undefined;
    if (dto.vehicleBrandName !== undefined)
      updateFields.vehicleBrandName = dto.vehicleBrandName;
    if (dto.modelId !== undefined)
      updateFields.modelId = dto.modelId
        ? new Types.ObjectId(dto.modelId)
        : undefined;
    if (dto.modelName !== undefined) updateFields.modelName = dto.modelName;
    if (dto.variantId !== undefined)
      updateFields.variantId = dto.variantId
        ? new Types.ObjectId(dto.variantId)
        : undefined;
    if (dto.variantName !== undefined)
      updateFields.variantName = dto.variantName;
    if (dto.categoryAttributes !== undefined) {
      updateFields.categoryAttributes = new Map(
        Object.entries(dto.categoryAttributes),
      );
    }
    if (dto.price !== undefined) {
      updateFields.price = {
        amount: dto.price.amount,
        currency: dto.price.currency ?? DEFAULT_CURRENCY,
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
        provinceId: dto.location.provinceId
          ? new Types.ObjectId(dto.location.provinceId)
          : undefined,
        cityId: dto.location.cityId
          ? new Types.ObjectId(dto.location.cityId)
          : undefined,
        areaId: dto.location.areaId
          ? new Types.ObjectId(dto.location.areaId)
          : undefined,
        city: dto.location.city,
        area: dto.location.area,
        province: dto.location.province,
        blockPhase: dto.location.blockPhase,
        mapLink: dto.location.mapLink,
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
        throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
      }
      updateFields.rejectionReason = undefined;
      updateFields.rejectionReasonIds = [];
      updateFields.rejectionNote = undefined;
      updateFields.rejectedAt = undefined;
    }

    // All edited listings go back to pending review
    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      updateFields.status = ListingStatus.PENDING_REVIEW;
    }

    const updated = await this.listingModel
      .findByIdAndUpdate(id, { $set: updateFields }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
    }
    const updateFields: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };
    if (status === AllowedStatusTransition.INACTIVE) {
      updateFields.deactivatedAt = new Date();
    } else {
      updateFields.deactivatedAt = null;
    }
    // Re-activate expired or inactive listings: reset expiresAt to 30 days from now
    if (
      status === AllowedStatusTransition.ACTIVE &&
      (listing.status === ListingStatus.EXPIRED ||
        listing.status === ListingStatus.INACTIVE)
    ) {
      updateFields.expiresAt = new Date(Date.now() + daysToMs(this.activeDays));
    }
    const updated = await this.listingModel
      .findByIdAndUpdate(id, { $set: updateFields }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Track packaged listing lifecycle events
    if (listing.purchaseId) {
      this.trackPackagedListingEvent(listing, status).catch((err) =>
        this.logger.warn(
          `Failed to track packaged listing event: ${(err as Error).message}`,
        ),
      );
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
    const isAdmin = isAdminRole(userRole);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
    if (listing.status === ListingStatus.DELETED) {
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    // Only decrement activeListingCount if the listing was in a state that counts as active
    if (
      listing.status === ListingStatus.ACTIVE ||
      listing.status === ListingStatus.RESERVED ||
      listing.status === ListingStatus.PENDING_REVIEW
    ) {
      await this.userModel
        .updateOne(
          { _id: listing.sellerId },
          { $inc: { activeListingCount: -1 } },
        )
        .exec();
    }

    // Track packaged listing deletion
    if (listing.purchaseId) {
      this.trackPackagedListingEvent(listing, 'deleted').catch((err) =>
        this.logger.warn(
          `Failed to track PACKAGED_LISTING_DELETED: ${(err as Error).message}`,
        ),
      );
    }

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
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
    }
    const rejCount = (listing as any).rejectionCount || 0;
    if (rejCount >= 3) {
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    const category = await this.categoryModel.findById(dto.categoryId).exec();
    if (!category) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    const inheritedAttributes = await this.resolveInheritedAttributes(category);
    this.validateCategoryAttributes(
      dto.categoryAttributes ?? {},
      inheritedAttributes,
    );
    this.validateSelectedFeatures(
      dto.selectedFeatures,
      await this.resolveInheritedFeatures(category),
    );
    const categoryPath = await this.buildCategoryPath(category);
    await this.validateBrandFields(dto, category, categoryPath);
    const seller = await this.userModel.findById(sellerId).exec();
    if (!seller) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (seller.activeListingCount >= seller.listingLimit) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
    if (!seller.phone || !seller.phoneVerified) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
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
        currency: dto.price.currency ?? DEFAULT_CURRENCY,
      },
      categoryId: new Types.ObjectId(dto.categoryId),
      categoryPath,
      condition: dto.condition,
      brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
      brandName: dto.brandName,
      vehicleBrandId: dto.vehicleBrandId
        ? new Types.ObjectId(dto.vehicleBrandId)
        : undefined,
      vehicleBrandName: dto.vehicleBrandName,
      modelId: dto.modelId ? new Types.ObjectId(dto.modelId) : undefined,
      modelName: dto.modelName,
      variantId: dto.variantId ? new Types.ObjectId(dto.variantId) : undefined,
      variantName: dto.variantName,
      categoryAttributes: dto.categoryAttributes
        ? new Map(Object.entries(dto.categoryAttributes))
        : new Map(),
      // Previously omitted, so every feature a seller ticked on the create form
      // was silently discarded and only reappeared if they later edited the ad.
      selectedFeatures: dto.selectedFeatures ?? [],
      images: (dto.images ?? []).map((img, idx) => ({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        sortOrder: img.sortOrder ?? idx,
      })),
      video: dto.video
        ? { url: dto.video.url, thumbnailUrl: dto.video.thumbnailUrl }
        : undefined,
      location: {
        provinceId: dto.location.provinceId
          ? new Types.ObjectId(dto.location.provinceId)
          : undefined,
        cityId: dto.location.cityId
          ? new Types.ObjectId(dto.location.cityId)
          : undefined,
        areaId: dto.location.areaId
          ? new Types.ObjectId(dto.location.areaId)
          : undefined,
        city: dto.location.city,
        area: dto.location.area,
        province: dto.location.province,
        blockPhase: dto.location.blockPhase,
        mapLink: dto.location.mapLink,
      },
      contactInfo: {
        phone: dto.contactInfo?.phone || seller.phone || '',
        email: dto.contactInfo?.email || seller.email || '',
      },
      sellerVerified: isSellerVerified(seller as any),
      status,
    });

    // Set default expiry — will be overridden if a package extends it
    const expiresAt = new Date(Date.now() + daysToMs(this.activeDays));
    listing.expiresAt = expiresAt;

    // Apply package if purchaseId is provided
    if (dto.purchaseId) {
      const { purchase, packageDoc } =
        await this.packagesService.applyPackageToListing(
          dto.purchaseId,
          sellerId,
          dto.categoryId,
          listing._id.toString(),
        );
      listing.purchaseId = new Types.ObjectId(dto.purchaseId);
      if (packageDoc.type === AdPackageType.FEATURED_ADS) {
        listing.isFeatured = true;
        listing.featuredUntil = purchase.expiresAt;
      }
      // Extend listing expiry to match package expiry if longer
      if (purchase.expiresAt && purchase.expiresAt > listing.expiresAt) {
        listing.expiresAt = purchase.expiresAt;
      }
    }

    const saved = await listing.save();
    await this.userModel
      .updateOne(
        { _id: new Types.ObjectId(sellerId) },
        { $inc: { activeListingCount: 1 } },
      )
      .exec();
    this.syncToEs(saved);
    return saved;
  }

  /**
   * Brings the `sellerVerified` badge on a seller's listings back in line with
   * their current verification state.
   *
   * `sellerVerified` is denormalised onto each listing so that search can filter
   * on it, and it used to be written only once, when the listing was created.
   * Nothing refreshed it afterwards, so any later change to the seller left every
   * one of their listings asserting the old answer — including showing "Verified
   * seller" for someone whose ID verification had been taken away.
   *
   * Re-indexes each changed listing explicitly rather than trusting the
   * Elasticsearch change stream, which is unavailable on a standalone MongoDB and
   * is disabled at runtime in that case.
   *
   * Returns how many listings changed, so callers can log a revocation.
   */
  async syncSellerVerified(sellerId: string): Promise<number> {
    const seller = await this.userModel
      .findById(sellerId)
      .select('emailVerified phoneVerified idVerified')
      .lean()
      .exec();
    const verified = isSellerVerified(seller as any);
    const filter = {
      sellerId: new Types.ObjectId(sellerId),
      sellerVerified: { $ne: verified },
    };

    // Read the stale ones first: after the update they no longer match, and each
    // needs re-indexing individually.
    const stale = await this.listingModel.find(filter).exec();
    if (stale.length === 0) return 0;

    await this.listingModel
      .updateMany(filter, { $set: { sellerVerified: verified } })
      .exec();

    for (const listing of stale) {
      listing.sellerVerified = verified;
      await this.syncToEs(listing);
    }

    this.logger.log(
      `Seller ${sellerId} verified=${verified}: updated ${stale.length} listing badge(s)`,
    );
    return stale.length;
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
    sellerName: string;
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
        .select(
          'emailVerified phoneVerified idVerified profile.firstName profile.lastName',
        )
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
      sellerName:
        [(user as any)?.profile?.firstName, (user as any)?.profile?.lastName]
          .filter(Boolean)
          .join(' ') || SEO_SELLER_FALLBACK_NAME,
      emailVerified: user?.emailVerified ?? false,
      phoneVerified: user?.phoneVerified ?? false,
      idVerified: (user as any)?.idVerified ?? false,
      activeAdsCount,
      responseRate,
      avgResponseTime,
    };
  }

  private static readonly TRANSITION_ACTION_MAP: ReadonlyMap<
    string,
    UserAction
  > = new Map([
    ['sold', UserAction.PACKAGED_LISTING_SOLD],
    ['inactive', UserAction.PACKAGED_LISTING_DEACTIVATED],
    ['deleted', UserAction.PACKAGED_LISTING_DELETED],
  ]);

  private async trackPackagedListingEvent(
    listing: ProductListingDocument,
    transition: string,
  ): Promise<void> {
    const action = ListingsService.TRANSITION_ACTION_MAP.get(transition);
    if (!action || !listing.purchaseId) return;

    const purchase = await this.packagesService.findPurchaseById(
      listing.purchaseId.toString(),
    );

    const metadata: Record<string, any> = {
      listingId: listing._id.toString(),
      purchaseId: listing.purchaseId.toString(),
      packageType: purchase?.type ?? null,
      categoryId:
        purchase?.categoryId?.toString() ?? listing.categoryId.toString(),
    };

    if (transition !== 'sold' && purchase) {
      metadata.remainingQuantityOnPurchase = purchase.remainingQuantity;
    }

    await this.adminTrackerService.track(
      listing.sellerId.toString(),
      action,
      metadata,
    );
  }

  private assertOwnership(
    listing: ProductListingDocument,
    sellerId: string,
  ): void {
    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }
  }

  private validateCategoryAttributes(
    attributes: Record<string, any>,
    definitions: CategoryAttribute[],
  ): void {
    for (const def of definitions) {
      const value = attributes[def.key];

      if (def.required && this.isAttributeValueMissing(value)) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      if (this.isAttributeValueMissing(value)) continue;

      switch (def.type) {
        case AttributeType.TEXT:
          if (typeof value !== 'string')
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          break;

        case AttributeType.NUMBER:
        case AttributeType.YEAR:
          if (typeof value !== 'number' || !Number.isFinite(value))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          this.assertWithinBounds(value, def);
          break;

        case AttributeType.BOOLEAN:
          if (typeof value !== 'boolean')
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          break;

        case AttributeType.SELECT:
          if (typeof value !== 'string')
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          // `allowOther` lets a seller supply a value outside the list, so the
          // options check only applies when it is off.
          if (
            !def.allowOther &&
            def.options &&
            def.options.length > 0 &&
            !def.options.includes(value)
          ) {
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          }
          break;

        case AttributeType.MULTISELECT:
          if (!Array.isArray(value))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (!def.allowOther && def.options && def.options.length > 0) {
            for (const entry of value) {
              if (!def.options.includes(entry)) {
                throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
              }
            }
          }
          break;

        case AttributeType.RANGE: {
          if (typeof value !== 'object' || Array.isArray(value))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          const { min, max } = value as { min?: unknown; max?: unknown };
          const hasMin = min !== undefined && min !== null;
          const hasMax = max !== undefined && max !== null;
          if (!hasMin && !hasMax)
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (hasMin && (typeof min !== 'number' || !Number.isFinite(min)))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (hasMax && (typeof max !== 'number' || !Number.isFinite(max)))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (hasMin && hasMax && min > max)
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (hasMin) this.assertWithinBounds(min, def);
          if (hasMax) this.assertWithinBounds(max, def);
          break;
        }

        // Stored as { provinceId, cityId, province, city }: the ids keep the
        // reference stable if a location is renamed, and the denormalised names
        // are what search indexes, filters and facets on.
        case AttributeType.PROVINCE_CITY: {
          if (typeof value !== 'object' || Array.isArray(value))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          const { provinceId, cityId, province, city } = value as {
            provinceId?: unknown;
            cityId?: unknown;
            province?: unknown;
            city?: unknown;
          };
          if (typeof provinceId !== 'string' || !provinceId)
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (!Types.ObjectId.isValid(provinceId))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (cityId !== undefined && cityId !== null && cityId !== '') {
            if (typeof cityId !== 'string' || !Types.ObjectId.isValid(cityId))
              throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          }
          // A name is required for the province, and for the city whenever one
          // was chosen, because search relies on them.
          if (typeof province !== 'string' || province.trim() === '')
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          if (cityId && (typeof city !== 'string' || city.trim() === ''))
            throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
          break;
        }
      }
    }
  }

  /** Normalises the stored `categoryAttributes` Map into a plain object. */
  private toPlainAttributes(stored: unknown): Record<string, any> {
    if (!stored) return {};
    if (stored instanceof Map) return Object.fromEntries(stored);
    return stored as Record<string, any>;
  }

  /**
   * Treats `0` and `false` as supplied answers. A bare truthiness check would
   * reject "0 previous owners" or an intentional "no".
   */
  private isAttributeValueMissing(value: unknown): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  private assertWithinBounds(value: number, def: CategoryAttribute): void {
    if (def.rangeMin !== undefined && def.rangeMin !== null) {
      if (value < def.rangeMin)
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    if (def.rangeMax !== undefined && def.rangeMax !== null) {
      if (value > def.rangeMax)
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
  }

  /**
   * Rejects features the category (or its ancestors) does not offer, so a
   * crafted request cannot attach arbitrary strings to a listing.
   */
  private validateSelectedFeatures(
    selected: string[] | undefined,
    allowed: string[],
  ): void {
    if (!selected || selected.length === 0) return;
    const permitted = new Set(allowed);
    for (const feature of selected) {
      if (!permitted.has(feature)) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
    }
  }

  /**
   * Ancestor chain for a category, root first. Attribute and feature
   * inheritance both derive from this ordering.
   */
  private async collectCategoryChain(
    category: CategoryDocument,
  ): Promise<CategoryDocument[]> {
    const chain: CategoryDocument[] = [];
    let current: CategoryDocument | null = category;
    while (current) {
      chain.unshift(current);
      current = current.parentId
        ? await this.categoryModel.findById(current.parentId).exec()
        : null;
    }
    return chain;
  }

  /**
   * Attributes a category effectively has, including those inherited from its
   * ancestors. Validation previously read `category.attributes` alone, so a
   * sub-category's inherited attributes were never enforced: required ones
   * could be omitted and select values were accepted unchecked.
   */
  private async resolveInheritedAttributes(
    category: CategoryDocument,
  ): Promise<CategoryAttribute[]> {
    const chain = await this.collectCategoryChain(category);
    const merged = new Map<string, CategoryAttribute>();
    for (const cat of chain) {
      for (const attr of cat.attributes ?? []) {
        // Leaf definitions win, matching the admin UI's override behaviour.
        merged.set(attr.key, attr);
      }
    }
    return Array.from(merged.values());
  }

  /** Union of the category's own features and every ancestor's. */
  private async resolveInheritedFeatures(
    category: CategoryDocument,
  ): Promise<string[]> {
    const chain = await this.collectCategoryChain(category);
    const merged = new Set<string>();
    for (const cat of chain) {
      for (const feature of cat.features ?? []) {
        merged.add(feature);
      }
    }
    return Array.from(merged);
  }

  /**
   * Validate brand/model/variant fields for categories that have hasBrands=true.
   * Checks the full category path (ancestors) for the hasBrands flag.
   * Determines brand type by checking if vehicle_brands exist for the category.
   */
  private async validateBrandFields(
    dto: CreateListingDto,
    category: CategoryDocument,
    categoryPath: Types.ObjectId[],
  ): Promise<void> {
    // Check if any category in the path has hasBrands
    let brandCategory: CategoryDocument | null = null;
    for (const catId of categoryPath) {
      const cat = await this.categoryModel.findById(catId).lean().exec();
      if (cat?.hasBrands) {
        brandCategory = cat;
        break;
      }
    }
    if (!brandCategory) return; // No brand requirement

    // Determine brand type by checking if vehicle_brands exist for this category
    const isVehicle = await this.hasVehicleBrands(
      brandCategory._id,
      categoryPath,
    );

    if (isVehicle) {
      // Vehicle brand is mandatory
      if (!dto.vehicleBrandId && !dto.vehicleBrandName) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      // If "other" brand, only name is needed
      if (dto.vehicleBrandId === OTHER_OPTION_ID) {
        if (!dto.vehicleBrandName) {
          throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
        }
        dto.vehicleBrandId = undefined;
        dto.modelId = undefined;
        dto.variantId = undefined;
        return;
      }
      if (dto.vehicleBrandId) {
        const brand = await this.vehicleBrandService.findById(
          dto.vehicleBrandId,
        );
        dto.vehicleBrandName = brand.name;
      }
      // Model is mandatory for vehicles (unless "other")
      if (!dto.modelId && !dto.modelName) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      if (dto.modelId === OTHER_OPTION_ID) {
        if (!dto.modelName) {
          throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
        }
        dto.modelId = undefined;
        dto.variantId = undefined;
        return;
      }
      if (dto.modelId) {
        const model = await this.vehicleModelService.findById(dto.modelId);
        dto.modelName = model.name;
      }
      // Variant is optional
      if (dto.variantId && dto.variantId !== OTHER_OPTION_ID) {
        const variant = await this.vehicleVariantService.findById(
          dto.variantId,
        );
        dto.variantName = variant.name;
      } else if (dto.variantId === OTHER_OPTION_ID) {
        dto.variantId = undefined;
      }
    } else {
      // Simple brand (mobile phones, future categories, etc.) — mandatory
      if (!dto.brandId && !dto.brandName) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      if (dto.brandId === OTHER_OPTION_ID) {
        if (!dto.brandName) {
          throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
        }
        dto.brandId = undefined;
        return;
      }
      if (dto.brandId) {
        const brand = await this.brandsService.findById(dto.brandId);
        dto.brandName = brand.name;
      }
    }
  }

  /**
   * Check if any category in the path has vehicle brands in the vehicle_brands collection.
   */
  private async hasVehicleBrands(
    brandCategoryId: Types.ObjectId,
    categoryPath: Types.ObjectId[],
  ): Promise<boolean> {
    // Check the brand category itself and all ancestors
    for (const catId of categoryPath) {
      const count = await this.vehicleBrandService.countByCategory(
        catId.toString(),
      );
      if (count > 0) return true;
    }
    return false;
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
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }

      // Strategy 2: Strip ALL non-digits, scan for Pakistani mobile patterns
      const digits = text.replace(/\D/g, '');
      const digitPatterns = [
        /0[3][0-9]{9}/, // 03xxxxxxxxx
        /920[3][0-9]{9}/, // 9203xxxxxxxxx
        /00920[3][0-9]{9}/, // 009203xxxxxxxxx
      ];
      if (digitPatterns.some((p) => p.test(digits))) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
    };
    check(title, 'title');
    check(description, 'description');
  }
}
