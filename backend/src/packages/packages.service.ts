import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DEFAULT_CURRENCY } from '../common/constants/index.js';
import {
  AdPackage,
  AdPackageDocument,
  AdPackageType,
} from './schemas/ad-package.schema.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentStatus,
} from './schemas/package-purchase.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { PaymentsService } from '../payments/payments.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PAYMENT_ROUTES } from '../payments/constants.js';
import { ApplyFailureReason } from './enums/apply-failure-reason.enum.js';
import { PurchaseResult } from './interfaces/purchase-result.interface.js';
import { AdLimitCheck } from './interfaces/ad-limit-check.interface.js';

export type { PurchaseResult, AdLimitCheck };

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    @InjectModel(AdPackage.name)
    private readonly adPackageModel: Model<AdPackageDocument>,
    @InjectModel(PackagePurchase.name)
    private readonly packagePurchaseModel: Model<PackagePurchaseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    private readonly paymentsService: PaymentsService,
    private readonly adminTrackerService: AdminTrackerService,
  ) {}

  async createPackage(dto: CreatePackageDto): Promise<AdPackageDocument> {
    const categoryPricing = (dto.categoryPricing || []).map((cp) => ({
      categoryId: new Types.ObjectId(cp.categoryId),
      price: cp.price,
    }));

    const pkg = new this.adPackageModel({
      name: dto.name,
      type: dto.type,
      duration: dto.duration,
      quantity: dto.quantity,
      defaultPrice: dto.defaultPrice,
      categoryPricing,
      isActive: dto.isActive ?? true,
    });

    return pkg.save();
  }

  async updatePackage(
    id: string,
    dto: UpdatePackageDto,
  ): Promise<AdPackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(ERROR.PACKAGE_NOT_FOUND);
    }

    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException(ERROR.PACKAGE_NOT_FOUND);
    }

    if (dto.name !== undefined) pkg.name = dto.name;
    if (dto.type !== undefined) pkg.type = dto.type;
    if (dto.duration !== undefined) pkg.duration = dto.duration;
    if (dto.quantity !== undefined) pkg.quantity = dto.quantity;
    if (dto.defaultPrice !== undefined) pkg.defaultPrice = dto.defaultPrice;
    if (dto.isActive !== undefined) pkg.isActive = dto.isActive;
    if (dto.categoryPricing !== undefined) {
      pkg.categoryPricing = dto.categoryPricing.map((cp) => ({
        categoryId: new Types.ObjectId(cp.categoryId),
        price: cp.price,
      })) as any;
    }

    return pkg.save();
  }

  async findAll(): Promise<AdPackageDocument[]> {
    return this.adPackageModel
      .find({ isActive: true })
      .sort({ type: 1, duration: 1 })
      .exec();
  }

  async findById(id: string): Promise<AdPackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(ERROR.PACKAGE_NOT_FOUND);
    }
    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException(ERROR.PACKAGE_NOT_FOUND);
    }
    return pkg;
  }

  async findPurchaseById(
    purchaseId: string,
  ): Promise<PackagePurchaseDocument | null> {
    if (!Types.ObjectId.isValid(purchaseId)) return null;
    return this.packagePurchaseModel.findById(purchaseId).exec();
  }

  async getAvailablePackages(
    sellerId: string,
    categoryId: string,
  ): Promise<PackagePurchaseDocument[]> {
    const now = new Date();
    return this.packagePurchaseModel
      .find({
        sellerId: new Types.ObjectId(sellerId),
        categoryId: new Types.ObjectId(categoryId),
        paymentStatus: PaymentStatus.COMPLETED,
        remainingQuantity: { $gt: 0 },
        expiresAt: { $gt: now },
      })
      .sort({ expiresAt: 1 })
      .populate('packageId', 'name type')
      .exec();
  }

  async applyPackageToListing(
    purchaseId: string,
    sellerId: string,
    categoryId: string,
    listingId?: string,
  ): Promise<{
    purchase: PackagePurchaseDocument;
    packageDoc: AdPackageDocument;
  }> {
    const now = new Date();

    // Atomic decrement — prevents concurrent over-decrement
    const updated = await this.packagePurchaseModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(purchaseId),
          sellerId: new Types.ObjectId(sellerId),
          categoryId: new Types.ObjectId(categoryId),
          paymentStatus: PaymentStatus.COMPLETED,
          remainingQuantity: { $gt: 0 },
          expiresAt: { $gt: now },
        },
        { $inc: { remainingQuantity: -1 } },
        { new: true },
      )
      .exec();

    if (updated) {
      const populated = await updated.populate<{
        packageId: AdPackageDocument;
      }>('packageId', 'name type');
      const packageDoc = populated.packageId as unknown as AdPackageDocument;

      // Track success
      this.adminTrackerService
        .track(sellerId, UserAction.PACKAGE_APPLY_SUCCESS, {
          purchaseId,
          packageType: packageDoc.type,
          categoryId,
          listingId: listingId ?? null,
          remainingQuantityAfter: updated.remainingQuantity,
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to track PACKAGE_APPLY_SUCCESS: ${(err as Error).message}`,
          ),
        );

      return {
        purchase: populated as unknown as PackagePurchaseDocument,
        packageDoc,
      };
    }

    // Atomic update returned null — determine the specific reason
    const purchase = await this.packagePurchaseModel
      .findById(purchaseId)
      .exec();

    if (!purchase) {
      throw new NotFoundException(ERROR.PURCHASE_NOT_FOUND);
    }

    if (purchase.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(ERROR.PACKAGE_OWN_ONLY);
    }

    // Determine failure reason and track it
    let reason: ApplyFailureReason = ApplyFailureReason.UNKNOWN;
    let errorMessage: string;

    if (purchase.categoryId?.toString() !== categoryId) {
      reason = ApplyFailureReason.CATEGORY_MISMATCH;
      errorMessage = ERROR.PACKAGE_CATEGORY_MISMATCH;
    } else if (purchase.paymentStatus !== PaymentStatus.COMPLETED) {
      reason = ApplyFailureReason.PAYMENT_NOT_COMPLETED;
      errorMessage = ERROR.PACKAGE_PAYMENT_NOT_COMPLETED;
    } else if (purchase.remainingQuantity <= 0) {
      reason = ApplyFailureReason.FULLY_USED;
      errorMessage = ERROR.PACKAGE_FULLY_USED;
    } else if (!purchase.expiresAt || purchase.expiresAt <= now) {
      reason = ApplyFailureReason.EXPIRED;
      errorMessage = ERROR.PACKAGE_EXPIRED;
    } else {
      errorMessage = ERROR.PURCHASE_NOT_FOUND;
    }

    // Track failure
    const failureMetadata: Record<string, any> = {
      purchaseId,
      categoryId,
      listingId: listingId ?? null,
      reason,
    };
    if (reason === ApplyFailureReason.CATEGORY_MISMATCH) {
      failureMetadata.purchaseCategoryId =
        purchase.categoryId?.toString() ?? null;
      failureMetadata.listingCategoryId = categoryId;
    }

    this.adminTrackerService
      .track(sellerId, UserAction.PACKAGE_APPLY_FAILED, failureMetadata)
      .catch((err) =>
        this.logger.warn(
          `Failed to track PACKAGE_APPLY_FAILED: ${(err as Error).message}`,
        ),
      );

    throw new BadRequestException(errorMessage);
  }

  async getMyPurchases(
    sellerId: string,
    categoryId?: string,
  ): Promise<PackagePurchaseDocument[]> {
    const filter: Record<string, any> = {
      sellerId: new Types.ObjectId(sellerId),
    };
    if (categoryId) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }
    return this.packagePurchaseModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name')
      .populate('packageId', 'name type')
      .exec();
  }

  async purchasePackages(
    sellerId: string,
    dto: PurchasePackageDto,
  ): Promise<PurchaseResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(ERROR.PAYMENT_PURCHASE_ITEM_REQUIRED);
    }
    const purchases: PackagePurchaseDocument[] = [];
    let totalAmount = 0;
    for (const item of dto.items) {
      const pkg = await this.findById(item.packageId);
      if (!pkg.isActive) {
        throw new BadRequestException(
          `${ERROR.PAYMENT_PACKAGE_UNAVAILABLE}: "${pkg.name}"`,
        );
      }
      let price = pkg.defaultPrice;
      if (item.categoryId && Types.ObjectId.isValid(item.categoryId)) {
        const catPricing = pkg.categoryPricing.find(
          (cp) => cp.categoryId.toString() === item.categoryId,
        );
        if (catPricing) {
          price = catPricing.price;
        }
      }
      totalAmount += price;
      const purchase = new this.packagePurchaseModel({
        sellerId: new Types.ObjectId(sellerId),
        packageId: pkg._id,
        categoryId: item.categoryId
          ? new Types.ObjectId(item.categoryId)
          : undefined,
        type: pkg.type,
        quantity: pkg.quantity,
        remainingQuantity: pkg.quantity,
        duration: pkg.duration,
        price,
        paymentMethod: dto.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
      });
      const saved = await purchase.save();
      purchases.push(saved);
    }
    const purchaseIds = purchases.map((p) => p._id.toString());
    const paymentResult = await this.paymentsService.initiatePayment(
      dto.paymentMethod,
      {
        amount: totalAmount,
        currency: DEFAULT_CURRENCY,
        purchaseIds,
        sellerId,
        callbackUrl: PAYMENT_ROUTES.PACKAGE_CALLBACK,
      },
    );
    await this.packagePurchaseModel.updateMany(
      { _id: { $in: purchases.map((p) => p._id) } },
      { $set: { paymentTransactionId: paymentResult.transactionId } },
    );
    return {
      purchases,
      redirectUrl: paymentResult.redirectUrl,
      transactionId: paymentResult.transactionId,
    };
  }

  async handlePaymentCallback(
    payload: Record<string, any>,
  ): Promise<{ status: string; message: string }> {
    // Resolve transaction ID from various callback formats
    const transactionId =
      payload.pp_TxnRefNo || // JazzCash
      payload.orderRefNumber || // EasyPaisa
      payload.transactionId || // Generic / Stripe
      payload.session_id; // Stripe redirect

    if (!transactionId) {
      throw new BadRequestException(ERROR.PAYMENT_TXN_ID_REQUIRED);
    }

    const purchases = await this.packagePurchaseModel
      .find({ paymentTransactionId: transactionId })
      .exec();

    if (purchases.length === 0) {
      throw new NotFoundException(ERROR.PAYMENT_NO_PURCHASES_FOR_TXN);
    }

    // Derive payment method from the stored purchase rather than the callback
    const paymentMethod = payload.paymentMethod || purchases[0].paymentMethod;

    const verification = await this.paymentsService.verifyCallback(
      paymentMethod,
      { ...payload, transactionId },
    );

    if (verification.status === 'completed') {
      const now = new Date();
      for (const purchase of purchases) {
        const expiresAt = new Date(
          now.getTime() + purchase.duration * 24 * 60 * 60 * 1000,
        );
        await this.packagePurchaseModel.updateOne(
          { _id: purchase._id },
          {
            $set: {
              paymentStatus: PaymentStatus.COMPLETED,
              activatedAt: now,
              expiresAt,
            },
          },
        );

        if (purchase.type === AdPackageType.AD_SLOTS) {
          await this.userModel.updateOne(
            { _id: purchase.sellerId },
            { $inc: { adLimit: purchase.quantity } },
          );
        }
      }
      return { status: 'success', message: ERROR.PAYMENT_PACKAGES_ACTIVATED };
    }

    await this.packagePurchaseModel.updateMany(
      { paymentTransactionId: transactionId },
      { $set: { paymentStatus: PaymentStatus.FAILED } },
    );
    return {
      status: 'failed',
      message: verification.reason ?? ERROR.PAYMENT_FAILED,
    };
  }

  async featureListing(
    listingId: string,
    sellerId: string,
  ): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(ERROR.PAYMENT_OWN_LISTING_ONLY);
    }

    if (listing.isFeatured) {
      throw new BadRequestException(ERROR.PAYMENT_ALREADY_FEATURED);
    }

    const now = new Date();
    const activePurchase = await this.packagePurchaseModel
      .findOne({
        sellerId: new Types.ObjectId(sellerId),
        type: AdPackageType.FEATURED_ADS,
        paymentStatus: PaymentStatus.COMPLETED,
        remainingQuantity: { $gt: 0 },
        expiresAt: { $gt: now },
      })
      .exec();

    if (!activePurchase) {
      throw new BadRequestException(ERROR.PAYMENT_NO_FEATURED_PACKAGE);
    }

    await this.packagePurchaseModel.updateOne(
      { _id: activePurchase._id },
      { $inc: { remainingQuantity: -1 } },
    );

    const updateFields: Record<string, any> = {
      isFeatured: true,
      featuredUntil: activePurchase.expiresAt,
    };
    // Extend listing expiry to match package expiry if longer
    if (
      activePurchase.expiresAt &&
      (!listing.expiresAt || activePurchase.expiresAt > listing.expiresAt)
    ) {
      updateFields.expiresAt = activePurchase.expiresAt;
    }

    const updated = await this.listingModel
      .findByIdAndUpdate(listingId, { $set: updateFields }, { new: true })
      .exec();

    return updated!;
  }

  async checkAdLimit(sellerId: string): Promise<AdLimitCheck> {
    const user = await this.userModel.findById(sellerId).exec();
    if (!user) {
      throw new NotFoundException(ERROR.SELLER_NOT_FOUND);
    }

    const canPost = user.activeAdCount < user.adLimit;
    return {
      canPost,
      activeAdCount: user.activeAdCount,
      adLimit: user.adLimit,
      message: canPost ? undefined : ERROR.PAYMENT_AD_LIMIT_REACHED,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredFeaturedAds(): Promise<number> {
    // Find listings that are about to be unflagged so we can track expiry events
    const expiredListings = await this.listingModel
      .find({
        isFeatured: true,
        featuredUntil: { $lte: new Date() },
        purchaseId: { $ne: null },
      })
      .select('purchaseId sellerId categoryId')
      .exec();

    // Track PACKAGE_EXPIRED for each listing with a purchaseId
    for (const listing of expiredListings) {
      try {
        const purchase = await this.packagePurchaseModel
          .findById(listing.purchaseId)
          .populate('packageId', 'type')
          .exec();
        if (purchase) {
          const packageDoc = purchase.packageId as unknown as AdPackageDocument;
          await this.adminTrackerService.track(
            listing.sellerId.toString(),
            UserAction.PACKAGE_EXPIRED,
            {
              purchaseId: purchase._id.toString(),
              categoryId: purchase.categoryId?.toString() ?? null,
              packageType: packageDoc?.type ?? purchase.type,
              sellerId: listing.sellerId.toString(),
              remainingQuantityAtExpiry: purchase.remainingQuantity,
            },
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to track PACKAGE_EXPIRED for listing ${listing._id}: ${(err as Error).message}`,
        );
      }
    }

    const result = await this.listingModel.updateMany(
      { isFeatured: true, featuredUntil: { $lte: new Date() } },
      { $set: { isFeatured: false }, $unset: { featuredUntil: '' } },
    );
    return result.modifiedCount;
  }
}
