import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesService } from './packages.service.js';
import { AdPackageType } from './schemas/ad-package.schema.js';
import { typeForEntitlements } from './entitlements.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { VerifiedUserGuard } from '../auth/guards/verified-user.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';
import { PACKAGE_ROUTES } from '../payments/constants.js';
import { ERROR } from '../common/constants/error-messages.js';

@Controller(PACKAGE_ROUTES.BASE)
export class PackagesController {
  constructor(
    private readonly packagesService: PackagesService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Get()
  async findAll() {
    return this.packagesService.findAll();
  }

  @Get(PACKAGE_ROUTES.AVAILABLE)
  @UseGuards(JwtAuthGuard)
  async getAvailablePackages(
    @CurrentUser('sub') sellerId: string,
    @Query('categoryId') categoryId: string,
  ) {
    if (!categoryId || !Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException(ERROR.INVALID_CATEGORY_ID_PARAM);
    }
    return this.packagesService.getAvailablePackages(sellerId, categoryId);
  }

  @Get(PACKAGE_ROUTES.MY_PURCHASES)
  @UseGuards(JwtAuthGuard)
  async getMyPurchases(
    @CurrentUser('sub') sellerId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException(ERROR.INVALID_CATEGORY_ID_FILTER);
    }
    return this.packagesService.getMyPurchases(sellerId, categoryId);
  }

  /**
   * What the seller currently holds, per entitlement kind.
   *
   * Before this there was no way to see it: ad slots showed up only as a larger
   * listing limit, and featured or shorts credit only as rows in purchase
   * history — where a bundle's `remainingQuantity` is the purchased total rather
   * than what is left.
   *
   * Declared above `:id` because Nest matches in order and would otherwise treat
   * the path as a package id.
   */
  @Get(PACKAGE_ROUTES.MY_ENTITLEMENTS)
  @UseGuards(JwtAuthGuard)
  async getMyEntitlements(@CurrentUser('sub') sellerId: string) {
    return this.packagesService.getEntitlementSummary(sellerId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.packagesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPackage(
    @Body() dto: CreatePackageDto,
    @CurrentUser('sub') adminId: string,
    @CurrentUser('role') role: string,
    @Req() req: any,
  ) {
    if (this.describesBundle(dto)) {
      this.assertSuperAdmin(role);
    }
    const pkg = await this.packagesService.createPackage(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_PACKAGE_CREATE,
      { packageName: dto.name, type: pkg.type },
      req,
    );
    return pkg;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePackage(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser('sub') adminId: string,
    @CurrentUser('role') role: string,
    @Req() req: any,
  ) {
    const oldPkg = await this.packagesService.findById(id);
    // Both sides are checked: editing an existing all-in-one is plainly restricted,
    // and converting an ordinary package into one is how that restriction would
    // otherwise be sidestepped.
    if (oldPkg.type === AdPackageType.BUNDLE || this.describesBundle(dto)) {
      this.assertSuperAdmin(role);
    }
    const snapshot: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      snapshot[key] = { from: (oldPkg as any)[key], to: (dto as any)[key] };
    }
    const pkg = await this.packagesService.updatePackage(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_PACKAGE_UPDATE,
      { packageId: id, packageName: oldPkg.name, changes: snapshot },
      req,
    );
    return pkg;
  }

  /**
   * Withdraws a package from the catalogue.
   *
   * The package is removed outright only if nothing was ever bought from it;
   * otherwise it is deactivated, so paid orders keep the package they refer to. The
   * response says which happened rather than reporting a deletion that did not
   * occur.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deletePackage(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @CurrentUser('role') role: string,
    @Req() req: any,
  ) {
    const pkg = await this.packagesService.findById(id);
    if (pkg.type === AdPackageType.BUNDLE) {
      this.assertSuperAdmin(role);
    }
    const result = await this.packagesService.deletePackage(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_PACKAGE_DELETE,
      {
        packageId: id,
        packageName: pkg.name,
        type: pkg.type,
        deleted: result.deleted,
        purchaseCount: result.purchaseCount,
      },
      req,
    );
    return result;
  }

  /**
   * Whether a payload would leave the package an all-in-one.
   *
   * Mirrors how the service resolves the stored type, so the permission check and
   * the write agree on what counts as a bundle. `type` is consulted as well because
   * a caller may still send it directly.
   */
  private describesBundle(dto: {
    type?: AdPackageType;
    entitlements?: { kind: any; quantity: number }[];
  }): boolean {
    if (dto.type === AdPackageType.BUNDLE) return true;
    if (!dto.entitlements?.length) return false;
    return typeForEntitlements(dto.entitlements) === AdPackageType.BUNDLE;
  }

  /**
   * All-in-one packages bundle every entitlement the platform sells and are priced
   * accordingly, so changing them is kept to super admins even though ordinary
   * admins may manage single-purpose packages.
   *
   * Enforced here rather than through `@Roles`, because whether a request touches a
   * bundle depends on the payload and the stored package, which guard metadata
   * cannot see.
   */
  private assertSuperAdmin(role: string): void {
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(ERROR.BUNDLE_SUPER_ADMIN_ONLY);
    }
  }

  @Post(PACKAGE_ROUTES.PURCHASE)
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  async purchasePackages(
    @CurrentUser('sub') sellerId: string,
    @Body() dto: PurchasePackageDto,
  ) {
    return this.packagesService.purchasePackages(sellerId, dto);
  }

  @Post(PACKAGE_ROUTES.PAYMENT_CALLBACK)
  async paymentCallback(@Body() payload: Record<string, any>) {
    return this.packagesService.handlePaymentCallback(payload);
  }
}
