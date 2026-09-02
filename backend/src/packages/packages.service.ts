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
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service.js';
import { FALLBACK_LISTING_LIMIT } from './constants/package-durations.js';
import { CRON_TIMEZONE, DEFAULT_CURRENCY } from '../common/constants/index.js';
import {
  AdPackage,
  AdPackageDocument,
  AdPackageType,
} from './schemas/ad-package.schema.js';
import {
  EntitlementGrant,
  EntitlementKind,
  grants,
  normaliseEntitlements,
  packageEntitlements,
  purchaseBalances,
  remainingOf,
  totalQuantity,
  typeForEntitlements,
} from './entitlements.js';
import {
  PackagePurchase,
  PackagePurchaseDocument,
  PaymentStatus,
  PurchaseType,
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
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { PAYMENT_ROUTES } from '../payments/constants.js';
import { ApplyFailureReason } from './enums/apply-failure-reason.enum.js';
import { PurchaseResult } from './interfaces/purchase-result.interface.js';
import { ListingLimitCheck } from './interfaces/ad-limit-check.interface.js';
import { daysToMs } from '../common/utils/time.js';

export type { PurchaseResult, ListingLimitCheck };

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
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.defaultListingLimit =
      this.configService.get<number>('listing.defaultListingLimit') ??
      FALLBACK_LISTING_LIMIT;
  }

  /** Base allowance for a seller with no packages. */
  private readonly defaultListingLimit: number;

  async createPackage(dto: CreatePackageDto): Promise<AdPackageDocument> {
    const categoryPricing = (dto.categoryPricing || []).map((cp) => ({
      categoryId: new Types.ObjectId(cp.categoryId),
      price: cp.price,
    }));

    const { type, quantity, entitlements } = this.resolvePackageShape(dto);

    const pkg = new this.adPackageModel({
      name: dto.name,
      type,
      duration: dto.duration,
      quantity,
      entitlements,
      defaultPrice: dto.defaultPrice,
      categoryPricing,
      isActive: dto.isActive ?? true,
    });

    return pkg.save();
  }

  /**
   * Works out a package's stored shape from either input form.
   *
   * Callers may send an explicit `entitlements` list, or the original
   * `type` + `quantity` pair. Both end up stored the same way: `type` and
   * `quantity` stay populated so existing filters, labels and reporting keep
   * working, and multi-entitlement packages additionally carry the list that
   * spending is actually tracked against.
   */
  private resolvePackageShape(dto: {
    type?: AdPackageType;
    quantity?: number;
    entitlements?: EntitlementGrant[];
  }): {
    type: AdPackageType;
    quantity: number;
    entitlements: EntitlementGrant[];
  } {
    if (dto.entitlements?.length) {
      const entitlements = normaliseEntitlements(dto.entitlements);
      if (entitlements.length === 0) {
        throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
      }
      const type = typeForEntitlements(entitlements);
      return {
        type,
        quantity: totalQuantity(entitlements),
        // Dropped only when `type` alone fully describes the grant, since storing
        // both would be a second copy to keep in step. Keyed off the resolved type
        // rather than the list length: a shorts-only package is a single
        // entitlement but has no legacy type of its own, so dropping its list
        // would leave a package that grants nothing.
        entitlements: type === AdPackageType.BUNDLE ? entitlements : [],
      };
    }

    // Legacy form. A bundle cannot be expressed this way — it would grant nothing.
    if (
      !dto.type ||
      dto.type === AdPackageType.BUNDLE ||
      !dto.quantity ||
      dto.quantity < 1
    ) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    return { type: dto.type, quantity: dto.quantity, entitlements: [] };
  }

  async updatePackage(
    id: string,
    dto: UpdatePackageDto,
  ): Promise<AdPackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (dto.name !== undefined) pkg.name = dto.name;
    if (dto.duration !== undefined) pkg.duration = dto.duration;
    if (dto.defaultPrice !== undefined) pkg.defaultPrice = dto.defaultPrice;

    // Type, quantity and entitlements describe one thing, so they are re-derived
    // together from whichever form the caller sent rather than assigned piecemeal.
    if (
      dto.entitlements !== undefined ||
      dto.type !== undefined ||
      dto.quantity !== undefined
    ) {
      const shape = this.resolvePackageShape({
        type: dto.type ?? pkg.type,
        quantity: dto.quantity ?? pkg.quantity,
        entitlements: dto.entitlements ?? undefined,
      });
      pkg.type = shape.type;
      pkg.quantity = shape.quantity;
      pkg.entitlements = shape.entitlements;
    }
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
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const pkg = await this.adPackageModel.findById(id).exec();
    if (!pkg) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return pkg;
  }

  async findPurchaseById(
    purchaseId: string,
  ): Promise<PackagePurchaseDocument | null> {
    if (!Types.ObjectId.isValid(purchaseId)) return null;
    return this.packagePurchaseModel.findById(purchaseId).exec();
  }

  /**
   * Purchases the seller can apply to a new listing in this category.
   *
   * Only featured credit can be applied to a listing, so that is what this offers.
   * It previously filtered on `remainingQuantity > 0`, which is never decremented
   * on a bundle — so a fully-spent bundle stayed in the picker for ever, and a
   * legacy ad-slots purchase was offered even though applying one always fails.
   */
  async getAvailablePackages(
    sellerId: string,
    categoryId: string,
  ): Promise<PackagePurchaseDocument[]> {
    const now = new Date();
    return this.packagePurchaseModel
      .find({
        ...this.entitlementFilter(sellerId, EntitlementKind.FEATURED_ADS, now),
        purchaseType: PurchaseType.ADS,
        categoryId: new Types.ObjectId(categoryId),
      })
      .sort({ expiresAt: 1 })
      .populate('packageId', 'name type')
      .exec();
  }

  /**
   * Spends one featured unit from a purchase, for a listing being created.
   *
   * Reports the kind it spent so the caller does not have to infer it from the
   * package's `type`. That inference broke for bundles: a bundle's type is
   * `bundle`, so the listing was never flagged featured even though a featured
   * unit had just been taken off the purchase — the seller paid and got nothing.
   */
  async applyPackageToListing(
    purchaseId: string,
    sellerId: string,
    categoryId: string,
    listingId?: string,
  ): Promise<{
    purchase: PackagePurchaseDocument;
    packageDoc: AdPackageDocument;
    spent: EntitlementKind;
  }> {
    const now = new Date();

    // Atomic decrement — prevents concurrent over-decrement.
    //
    // Spends the featured entitlement specifically. An ad-slots purchase has
    // already been credited to the seller's listing limit, so letting it be
    // "applied" to a listing spent it a second time for no benefit.
    const updated = await this.spendEntitlement(
      {
        _id: new Types.ObjectId(purchaseId),
        sellerId: new Types.ObjectId(sellerId),
        categoryId: new Types.ObjectId(categoryId),
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $gt: now },
      },
      EntitlementKind.FEATURED_ADS,
    );

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
        spent: EntitlementKind.FEATURED_ADS,
      };
    }

    // Atomic update returned null — determine the specific reason
    const purchase = await this.packagePurchaseModel
      .findById(purchaseId)
      .exec();

    if (!purchase) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (purchase.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
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

    throw new BadRequestException(PUBLIC_ERROR.PAYMENT_FAILED);
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
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    const purchases: PackagePurchaseDocument[] = [];
    let totalAmount = 0;
    for (const item of dto.items) {
      const pkg = await this.findById(item.packageId);
      if (!pkg.isActive) {
        throw new BadRequestException(PUBLIC_ERROR.PACKAGE_UNAVAILABLE);
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
      // Snapshotted, not referenced: editing the package later must not change
      // what an existing buyer is owed.
      const granted = packageEntitlements(pkg);
      if (granted.length === 0) {
        throw new BadRequestException(PUBLIC_ERROR.PACKAGE_UNAVAILABLE);
      }

      const purchase = new this.packagePurchaseModel({
        purchaseType: PurchaseType.ADS,
        sellerId: new Types.ObjectId(sellerId),
        packageId: pkg._id,
        categoryId: item.categoryId
          ? new Types.ObjectId(item.categoryId)
          : undefined,
        type: pkg.type,
        quantity: pkg.quantity,
        remainingQuantity: pkg.quantity,
        // Kept only when `type` cannot express the grant on its own, matching the
        // rule the package itself is stored under. Testing `granted.length > 1`
        // instead was wrong for a single-entitlement grant with no legacy type of
        // its own — a shorts-only ad package: `type` came out as `bundle`, the
        // list was dropped, and `purchaseBalances` has no fallback for `bundle`,
        // so the purchase read as granting nothing. The seller paid and the credit
        // could never be spent.
        entitlements:
          typeForEntitlements(granted) === AdPackageType.BUNDLE
            ? granted.map((e) => ({ ...e, remaining: e.quantity }))
            : [],
        duration: pkg.duration,
        price,
        currency: DEFAULT_CURRENCY,
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
      throw new BadRequestException(PUBLIC_ERROR.PAYMENT_FAILED);
    }

    const purchases = await this.packagePurchaseModel
      .find({ paymentTransactionId: transactionId })
      .exec();

    if (purchases.length === 0) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
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
        const expiresAt = new Date(now.getTime() + daysToMs(purchase.duration));

        // Guarded on PENDING so a replayed or duplicated callback cannot activate
        // the same purchase twice. Gateways retry, and users refresh the return
        // URL; without this the ad-slot credit below was applied again every time.
        const activation = await this.packagePurchaseModel.updateOne(
          { _id: purchase._id, paymentStatus: PaymentStatus.PENDING },
          {
            $set: {
              paymentStatus: PaymentStatus.COMPLETED,
              activatedAt: now,
              expiresAt,
            },
          },
        );

        if (activation.modifiedCount === 0) {
          this.logger.warn(
            `Ignoring repeat activation of purchase ${purchase._id.toString()}`,
          );
          continue;
        }

        await this.creditEntitlements(purchase);
      }
      return { status: 'success', message: ERROR.PAYMENT_PACKAGES_ACTIVATED };
    }

    // Only pending purchases are failed. Without the guard a late or replayed
    // failure callback downgraded an already-completed purchase, and because the
    // ad-slot claw-back cron only looks at completed purchases those credited
    // slots were then never reversed — the seller's listing limit stayed inflated
    // permanently.
    await this.packagePurchaseModel.updateMany(
      {
        paymentTransactionId: transactionId,
        paymentStatus: PaymentStatus.PENDING,
      },
      { $set: { paymentStatus: PaymentStatus.FAILED } },
    );
    return {
      status: 'failed',
      message: verification.reason ?? ERROR.PAYMENT_FAILED,
    };
  }

  /**
   * Applies the up-front half of a purchase's entitlements.
   *
   * Ad slots raise the seller's listing limit, so they take effect at activation
   * and stop applying at expiry. Featured ads and shorts are spent from the
   * purchase row as they are used, so they need nothing here.
   */
  private async creditEntitlements(
    purchase: PackagePurchaseDocument,
  ): Promise<void> {
    const grantsSlots = purchaseBalances(purchase).some(
      (e) => e.kind === EntitlementKind.AD_SLOTS && e.quantity > 0,
    );
    if (grantsSlots) {
      await this.reconcileListingLimit(purchase.sellerId.toString());
    }
  }

  /**
   * Recomputes a seller's listing limit from their base allowance plus the slots
   * of every package currently active.
   *
   * Derived rather than adjusted, because three writers used to share one number
   * and disagree about it: activation added with `$inc`, expiry subtracted a
   * snapshot and floored the result, and an admin overwrote it outright. That
   * produced limits that drifted permanently upward on a replayed callback, went
   * *up* when a package expired after an admin had lowered them, and under-clawed
   * when two packages lapsed in the same run.
   *
   * Recomputing is idempotent, so calling it twice is harmless and no caller has
   * to reason about ordering. Expired purchases fall out on their own via
   * `expiresAt`, so it needs no cooperation from the expiry marker.
   */
  async reconcileListingLimit(sellerId: string): Promise<number> {
    const now = new Date();
    const sellerObjectId = new Types.ObjectId(sellerId);

    const user = await this.userModel
      .findById(sellerObjectId)
      .select('baseListingLimit listingLimit')
      .exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const slotPurchases = await this.packagePurchaseModel
      .find({
        sellerId: sellerObjectId,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $gt: now },
        $or: [
          { type: AdPackageType.AD_SLOTS },
          { entitlements: { $elemMatch: { kind: EntitlementKind.AD_SLOTS } } },
        ],
      })
      .exec();

    const granted = slotPurchases.reduce(
      (sum, purchase) =>
        sum +
        (purchaseBalances(purchase).find(
          (e) => e.kind === EntitlementKind.AD_SLOTS,
        )?.quantity ?? 0),
      0,
    );

    // Users created before `baseListingLimit` existed have no value stored, so
    // fall back to the configured default rather than treating it as zero.
    const base = user.baseListingLimit ?? this.defaultListingLimit;
    const target = base + granted;

    if (user.listingLimit !== target) {
      await this.userModel
        .updateOne(
          { _id: sellerObjectId },
          { $set: { baseListingLimit: base, listingLimit: target } },
        )
        .exec();
    }

    return target;
  }

  /**
   * Spends one unit of `kind` from a purchase, atomically.
   *
   * Two storage shapes have to be handled: a bundle tracks a balance per
   * entitlement, while a single-purpose purchase uses the flat
   * `remainingQuantity`. Both are decremented with a conditional update so
   * concurrent requests cannot overspend — the previous read-then-write in
   * `featureListing` allowed exactly that.
   *
   * Returns the updated purchase, or null when it no longer qualifies.
   */
  private async spendEntitlement(
    filter: Record<string, any>,
    kind: EntitlementKind,
  ): Promise<PackagePurchaseDocument | null> {
    // Single-entitlement purchase: the flat counter is the balance, and the type
    // has to match or an ad-slots purchase could be spent as a featured ad.
    //
    // Tried first because the two filters are mutually exclusive — the legacy one
    // requires an empty `entitlements`, the bundle one requires a matching element
    // — so ordering cannot affect the outcome, only how many round trips the
    // common case costs. Nearly every purchase on file is still the legacy shape.
    const legacySpend = await this.packagePurchaseModel
      .findOneAndUpdate(
        {
          ...filter,
          ...this.legacyKindFilter(kind),
          remainingQuantity: { $gt: 0 },
        },
        { $inc: { remainingQuantity: -1 } },
        { new: true },
      )
      .exec();
    if (legacySpend) return legacySpend;

    // Bundle: the balance lives on the matching entitlement. Guarded in both the
    // filter and the array filter, so a concurrent spend cannot take it negative.
    return this.packagePurchaseModel
      .findOneAndUpdate(
        {
          ...filter,
          entitlements: { $elemMatch: { kind, remaining: { $gt: 0 } } },
        },
        { $inc: { 'entitlements.$[slot].remaining': -1 } },
        {
          arrayFilters: [{ 'slot.kind': kind, 'slot.remaining': { $gt: 0 } }],
          new: true,
        },
      )
      .exec();
  }

  /**
   * How a pre-bundle purchase of this kind identifies itself.
   *
   * The discriminator alone is enough to tell the two shapes apart, so no
   * condition on `entitlements` is needed — and none may be used. A bundle always
   * has `type: 'bundle'` (see `typeForEntitlements`) and `purchaseType: 'ads'`, so
   * it can never match any branch below.
   *
   * Testing `entitlements: { $size: 0 }` here was a serious mistake: purchases
   * written before the field existed have no `entitlements` at all, and MongoDB
   * does not treat a missing field as an empty array. That filter matched none of
   * them, which made every pre-existing purchase impossible to spend — no
   * promoting a listing, no applying a package, no posting a paid short. Mocked
   * tests could not see it because they do not implement `$size`.
   */
  private legacyKindFilter(kind: EntitlementKind): Record<string, any> {
    if (kind === EntitlementKind.AD_SLOTS) {
      return { type: AdPackageType.AD_SLOTS };
    }
    if (kind === EntitlementKind.FEATURED_ADS) {
      return { type: AdPackageType.FEATURED_ADS };
    }
    return { purchaseType: PurchaseType.SHORTS };
  }

  /**
   * Matches purchases that can still be spent on `kind`, in either storage shape.
   *
   * Used to find a candidate before spending, and to report what a seller holds.
   */
  entitlementFilter(
    sellerId: string,
    kind: EntitlementKind,
    now: Date,
  ): Record<string, any> {
    return {
      sellerId: new Types.ObjectId(sellerId),
      paymentStatus: PaymentStatus.COMPLETED,
      expiresAt: { $gt: now },
      $or: [
        { entitlements: { $elemMatch: { kind, remaining: { $gt: 0 } } } },
        {
          remainingQuantity: { $gt: 0 },
          ...this.legacyKindFilter(kind),
        },
      ],
    };
  }

  /**
   * What the seller currently holds, per kind.
   *
   * Sellers previously had no way to see this: ad slots showed up only as a bigger
   * listing limit, and featured or shorts credit was visible solely as rows in
   * purchase history.
   */
  async getEntitlementSummary(sellerId: string): Promise<
    {
      kind: EntitlementKind;
      remaining: number;
      nextExpiresAt: Date | null;
    }[]
  > {
    const now = new Date();
    const purchases = await this.packagePurchaseModel
      .find({
        sellerId: new Types.ObjectId(sellerId),
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { $gt: now },
      })
      .sort({ expiresAt: 1 })
      .exec();

    return Object.values(EntitlementKind).map((kind) => {
      const holding = purchases.filter((p) => grants(p, kind));
      return {
        kind,
        remaining: holding.reduce((sum, p) => sum + remainingOf(p, kind), 0),
        nextExpiresAt: holding[0]?.expiresAt ?? null,
      };
    });
  }

  /**
   * Refunds a purchase and withdraws whatever it still entitled the seller to.
   *
   * Records the refund and reverses the entitlements; it does not move money.
   * Returning funds happens in the gateway (JazzCash and EasyPaisa are portal
   * operations, Stripe has an API), and pretending otherwise here would leave the
   * two out of step. This marks our side so the seller stops being entitled the
   * moment the decision is made.
   *
   * What is withdrawn:
   *
   * - Unused featured and shorts credit is zeroed, so it cannot be spent after
   *   the money has gone back.
   * - Ad slots come off the listing limit, because `reconcileListingLimit` counts
   *   only completed purchases and this one is no longer completed.
   *
   * What is deliberately left alone: promotion already delivered. A listing that
   * has been featured for two weeks had that value, and retracting it would punish
   * buyers who saw the ad rather than recovering anything. Listings stay featured
   * until their own `featuredUntil` passes.
   *
   * A seller left over their listing limit by the slot withdrawal is handled by
   * the enforcement cron, which warns before it acts.
   */
  async refundPurchase(
    purchaseId: string,
    adminId: string,
    reason?: string,
  ): Promise<PackagePurchaseDocument> {
    if (!Types.ObjectId.isValid(purchaseId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const purchase = await this.packagePurchaseModel
      .findById(purchaseId)
      .exec();
    if (!purchase) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (purchase.paymentStatus === PaymentStatus.REFUNDED) {
      // Idempotent rather than an error: a double-click should not read as a
      // failure, and refunding twice must never withdraw twice.
      return purchase;
    }

    if (purchase.paymentStatus !== PaymentStatus.COMPLETED) {
      // Nothing was ever charged, so there is nothing to give back. A pending
      // payment should be left to fail on its own.
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    // Guarded on the status so two concurrent refunds cannot both proceed.
    const claimed = await this.packagePurchaseModel.updateOne(
      { _id: purchase._id, paymentStatus: PaymentStatus.COMPLETED },
      {
        $set: {
          paymentStatus: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          refundedBy: new Types.ObjectId(adminId),
          ...(reason ? { refundReason: reason } : {}),
          // Withdraw what is unspent, in whichever shape the purchase uses.
          remainingQuantity: 0,
          ...(purchase.entitlements?.length
            ? {
                entitlements: purchase.entitlements.map((e) => ({
                  kind: e.kind,
                  quantity: e.quantity,
                  remaining: 0,
                })),
              }
            : {}),
        },
      },
    );

    if (claimed.modifiedCount === 0) {
      return (await this.packagePurchaseModel.findById(purchaseId).exec())!;
    }

    // Slots fall out of the sum now the purchase is no longer completed.
    const newLimit = await this.reconcileListingLimit(
      purchase.sellerId.toString(),
    );

    const packageDoc = await this.adPackageModel
      .findById(purchase.packageId)
      .select('name')
      .exec();

    this.notificationsService
      .sendPurchaseRefundedNotification(
        purchase.sellerId.toString(),
        packageDoc?.name ?? 'Package',
        purchase.price,
        purchase.currency ?? DEFAULT_CURRENCY,
        reason,
      )
      .catch((err) =>
        this.logger.warn(
          `Failed to send refund notification: ${(err as Error).message}`,
        ),
      );

    this.adminTrackerService
      .track(adminId, UserAction.ADMIN_PACKAGE_REFUND, {
        purchaseId,
        sellerId: purchase.sellerId.toString(),
        amount: purchase.price,
        currency: purchase.currency ?? DEFAULT_CURRENCY,
        packageName: packageDoc?.name ?? null,
        reason: reason ?? null,
        newListingLimit: newLimit,
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to track ADMIN_PACKAGE_REFUND: ${(err as Error).message}`,
        ),
      );

    this.logger.log(
      `Refunded purchase ${purchaseId} for seller ${purchase.sellerId.toString()}`,
    );

    return (await this.packagePurchaseModel.findById(purchaseId).exec())!;
  }

  async featureListing(
    listingId: string,
    sellerId: string,
  ): Promise<ProductListingDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (listing.sellerId.toString() !== sellerId) {
      throw new ForbiddenException(PUBLIC_ERROR.FORBIDDEN);
    }

    if (listing.isFeatured) {
      throw new BadRequestException(PUBLIC_ERROR.LISTING_ACTION_FAILED);
    }

    const now = new Date();

    // Soonest-expiring first, so credit that is about to be lost is spent before
    // credit that still has weeks on it. Picking an arbitrary match, as this did,
    // could burn the long-lived one and let the other lapse unused.
    const candidates = await this.packagePurchaseModel
      .find(this.entitlementFilter(sellerId, EntitlementKind.FEATURED_ADS, now))
      .sort({ expiresAt: 1 })
      .select('_id')
      .exec();

    let activePurchase: PackagePurchaseDocument | null = null;
    for (const candidate of candidates) {
      // Conditional spend: whichever request gets there first takes the unit, so
      // two concurrent promotions cannot both consume the same one.
      activePurchase = await this.spendEntitlement(
        { _id: candidate._id },
        EntitlementKind.FEATURED_ADS,
      );
      if (activePurchase) break;
    }

    if (!activePurchase) {
      throw new BadRequestException(PUBLIC_ERROR.PACKAGE_UNAVAILABLE);
    }

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

  async checkListingLimit(sellerId: string): Promise<ListingLimitCheck> {
    const user = await this.userModel.findById(sellerId).exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const canPost = user.activeListingCount < user.listingLimit;
    return {
      canPost,
      activeListingCount: user.activeListingCount,
      listingLimit: user.listingLimit,
      message: canPost ? undefined : ERROR.LISTING_LIMIT_REACHED,
    };
  }

  @Cron(CronExpression.EVERY_HOUR, { timeZone: CRON_TIMEZONE })
  async handleExpiredFeaturedAds(): Promise<number> {
    // One clock for both queries. They used to call `new Date()` separately, so a
    // promotion expiring between them was reported as expired and then left
    // flagged until the next hour.
    const now = new Date();

    // Find listings that are about to be unflagged so we can track expiry events
    const expiredListings = await this.listingModel
      .find({
        isFeatured: true,
        featuredUntil: { $lte: now },
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
      { isFeatured: true, featuredUntil: { $lte: now } },
      { $set: { isFeatured: false }, $unset: { featuredUntil: '' } },
    );
    return result.modifiedCount;
  }
}
