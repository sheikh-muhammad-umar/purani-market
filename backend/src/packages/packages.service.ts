import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdPackage, AdPackageDocument, AdPackageType } from './schemas/ad-package.schema.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentMethod,
  PaymentStatus,
} from './schemas/package-purchase.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';

export interface PurchaseResult {
  purchases: PackagePurchaseDocument[];
  redirectUrl: string;
  transactionId: string;
}

export interface AdLimitCheck {
  canPost: boolean;
  activeAdCount: number;
  adLimit: number;
  message?: string;
}

@Injectable()
export class PackagesService {
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

  async updatePackage(id: string, dto: UpdatePackageDto): Promise<AdPackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Package not found');
    }

    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
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
      throw new NotFoundException('Package not found');
    }
    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException('Package not found');
    }
    return pkg;
  }

  async getMyPurchases(sellerId: string): Promise<PackagePurchaseDocument[]> {
    return this.packagePurchaseModel
      .find({ sellerId: new Types.ObjectId(sellerId) })
      .sort({ createdAt: -1 })
      .populate('packageId')
      .exec();
  }

  async purchasePackages(sellerId: string, dto: PurchasePackageDto): Promise<PurchaseResult> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one package item is required');
    }
    const purchases: PackagePurchaseDocument[] = [];
    let totalAmount = 0;
    for (const item of dto.items) {
      const pkg = await this.findById(item.packageId);
      if (!pkg.isActive) {
        throw new BadRequestException(`Package "${pkg.name}" is not available`);
      }
      let price = pkg.defaultPrice;
      if (item.categoryId && Types.ObjectId.isValid(item.categoryId)) {
        const catPricing = pkg.categoryPricing.find(
          (cp) => cp.categoryId.toString() === item.categoryId,
        );
        if (catPricing) { price = catPricing.price; }
      }
      totalAmount += price;
      const purchase = new this.packagePurchaseModel({
        sellerId: new Types.ObjectId(sellerId),
        packageId: pkg._id,
        categoryId: item.categoryId ? new Types.ObjectId(item.categoryId) : undefined,
        type: pkg.type, quantity: pkg.quantity, remainingQuantity: pkg.quantity,
        duration: pkg.duration, price,
        paymentMethod: dto.paymentMethod, paymentStatus: PaymentStatus.PENDING,
      });
      const saved = await purchase.save();
      purchases.push(saved);
    }
    const purchaseIds = purchases.map((p) => p._id.toString());
    const paymentResult = await this.paymentsService.initiatePayment(dto.paymentMethod, {
      amount: totalAmount, currency: 'PKR', purchaseIds, sellerId,
      callbackUrl: '/api/packages/payment-callback',
    });
    await this.packagePurchaseModel.updateMany(
      { _id: { $in: purchases.map((p) => p._id) } },
      { $set: { paymentTransactionId: paymentResult.transactionId } },
    );
    return { purchases, redirectUrl: paymentResult.redirectUrl, transactionId: paymentResult.transactionId };
  }

  async handlePaymentCallback(payload: Record<string, any>): Promise<{ status: string; message: string }> {
    const { transactionId, paymentMethod } = payload;
    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    const purchases = await this.packagePurchaseModel
      .find({ paymentTransactionId: transactionId })
      .exec();

    if (purchases.length === 0) {
      throw new NotFoundException('No purchases found for this transaction');
    }

    const verification = await this.paymentsService.verifyCallback(paymentMethod, payload);

    if (verification.status === 'completed') {
      const now = new Date();
      for (const purchase of purchases) {
        const expiresAt = new Date(now.getTime() + purchase.duration * 24 * 60 * 60 * 1000);
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
      return { status: 'success', message: 'Packages activated successfully' };
    }

    await this.packagePurchaseModel.updateMany(
      { paymentTransactionId: transactionId },
      { $set: { paymentStatus: PaymentStatus.FAILED } },
    );
    return { status: 'failed', message: verification.reason || 'Payment failed' };
  }

  async featureListing(listingId: string, sellerId: string): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException('Listing not found');
    }

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException('You can only feature your own listings');
    }

    if (listing.isFeatured) {
      throw new BadRequestException('Listing is already featured');
    }

    const now = new Date();
    const activePurchase = await this.packagePurchaseModel.findOne({
      sellerId: new Types.ObjectId(sellerId),
      type: AdPackageType.FEATURED_ADS,
      paymentStatus: PaymentStatus.COMPLETED,
      remainingQuantity: { $gt: 0 },
      expiresAt: { $gt: now },
    }).exec();

    if (!activePurchase) {
      throw new BadRequestException('No active featured ad package available. Please purchase a featured ads package.');
    }

    await this.packagePurchaseModel.updateOne(
      { _id: activePurchase._id },
      { $inc: { remainingQuantity: -1 } },
    );

    const updated = await this.listingModel.findByIdAndUpdate(
      listingId,
      {
        $set: {
          isFeatured: true,
          featuredUntil: activePurchase.expiresAt,
        },
      },
      { new: true },
    ).exec();

    return updated!;
  }

  async checkAdLimit(sellerId: string): Promise<AdLimitCheck> {
    const user = await this.userModel.findById(sellerId).exec();
    if (!user) {
      throw new NotFoundException('Seller not found');
    }

    const canPost = user.activeAdCount < user.adLimit;
    return {
      canPost,
      activeAdCount: user.activeAdCount,
      adLimit: user.adLimit,
      message: canPost
        ? undefined
        : 'You have reached your ad limit. Please purchase an ad package to post more ads.',
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredFeaturedAds(): Promise<number> {
    const result = await this.listingModel.updateMany(
      { isFeatured: true, featuredUntil: { $lte: new Date() } },
      { $set: { isFeatured: false }, $unset: { featuredUntil: '' } },
    );
    return result.modifiedCount;
  }
}
