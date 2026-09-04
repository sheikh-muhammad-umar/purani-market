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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ListingsService } from './listings.service.js';
import { parseOwnListingView } from './own-listing-view.js';
import { MediaService } from './media.service.js';
import { PackagesService } from '../packages/packages.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { VerifiedUserGuard } from '../auth/guards/verified-user.guard.js';
import { PhoneVerifiedGuard } from '../auth/guards/phone-verified.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UploadMediaDto } from './dto/upload-media.dto.js';

@Controller('api/listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly mediaService: MediaService,
    private readonly packagesService: PackagesService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getListings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('mine') mine?: string,
    @Query('sellerId') sellerIdParam?: string,
    @Query('categoryId') categoryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('area') area?: string,
    @Query('view') view?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    // `mine` wins over an explicit sellerId, and is the only thing that unlocks
    // non-active listings. A public `sellerId` — which is what a seller profile
    // page sends — filters to that seller but still sees active listings only.
    //
    // The sellerId parameter used to be ignored entirely, so a seller profile
    // received an unfiltered list and showed other sellers' listings.
    const ownListings = mine === 'true' && !!userId;
    const sellerId = ownListings ? userId : sellerIdParam || undefined;

    return this.listingsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      sort || 'createdAt',
      order === 'asc' ? 'asc' : 'desc',
      sellerId,
      {
        categoryId,
        provinceId,
        cityId,
        areaId,
        province,
        city,
        area,
        // Parsed rather than cast, so an unknown value falls back to "all"
        // instead of reaching the query and matching nothing — a seller mistyping
        // a URL should see their listings, not an empty page.
        ownView: parseOwnListingView(view),
      },
      ownListings,
    );
  }

  /**
   * How many of the caller's own listings sit in each filter view.
   *
   * Its own endpoint rather than part of the list response because the counts
   * describe the whole account and do not change as the seller pages through or
   * switches tabs — folding them into the list would recompute all seven on every
   * page change.
   */
  @Get('my/view-counts')
  @UseGuards(JwtAuthGuard)
  async getMyViewCounts(@CurrentUser('sub') userId: string) {
    return this.listingsService.getOwnViewCounts(userId);
  }

  @Get('featured')
  async getFeaturedAds(
    @Query('category') categoryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('city') city?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.listingsService.getFeaturedAds({
      categoryId,
      provinceId,
      cityId,
      areaId,
      city,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { data };
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getListingById(
    @Param('id') id: string,
    @Req() req: any,
    @CurrentUser('sub') userId?: string,
    @CurrentUser('role') userRole?: string,
  ) {
    const listing = await this.listingsService.findByIdAndIncrementViews(
      id,
      userId,
      userRole,
      req,
    );
    const obj = listing.toJSON();

    // Strip internal fields from response
    delete obj.purchaseId;
    delete obj.rejectionReasonIds;
    delete obj.rejectionNote;
    delete obj.rejectedAt;
    delete obj.deactivatedAt;
    delete obj.deletionReason;

    // Strip seller contact info for anonymous users
    if (!userId) {
      delete obj.contactInfo;
    }

    // Always include seller name (public info)
    const seller = await this.listingsService.getSellerVerification(
      listing.sellerId.toString(),
    );

    // Seller name, rating, and verification status are public trust signals
    // shown to everyone. The per-channel flags must be public because the
    // denormalized `sellerVerified` seal (email AND phone AND ID) is already in
    // the response for anonymous users; withholding the granular flags made the
    // badges render "not verified" alongside a "Verified" seal.
    const publicSeller = {
      sellerName: seller.sellerName,
      sellerRating: seller.rating,
      sellerReviewCount: seller.reviewCount,
      sellerEmailVerified: seller.emailVerified,
      sellerPhoneVerified: seller.phoneVerified,
      sellerIdVerified: seller.idVerified,
    };

    // Enrich with private seller stats for authenticated users only.
    if (userId) {
      return {
        ...obj,
        ...publicSeller,
        sellerActiveAdsCount: seller.activeAdsCount,
        sellerResponseRate: seller.responseRate,
        sellerAvgResponseTime: seller.avgResponseTime,
      };
    }

    return { ...obj, ...publicSeller };
  }

  @Post()
  @UseGuards(JwtAuthGuard, VerifiedUserGuard, PhoneVerifiedGuard)
  async createListing(
    @CurrentUser('sub') sellerId: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.create(sellerId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateListing(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, sellerId, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateListingStatus(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.listingsService.updateStatus(id, sellerId, dto.status);
  }

  @Post(':id/resubmit')
  @UseGuards(JwtAuthGuard)
  async resubmitListing(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
  ) {
    return this.listingsService.resubmitForReview(id, sellerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteListing(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() body?: { reason?: string },
  ) {
    return this.listingsService.softDelete(id, userId, userRole, body?.reason);
  }

  @Post(':id/feature')
  @UseGuards(JwtAuthGuard)
  async featureListing(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
  ) {
    return this.packagesService.featureListing(id, sellerId);
  }

  @Post(':id/media')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Param('id') listingId: string,
    @CurrentUser('sub') sellerId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.mediaService.uploadMedia(
      listingId,
      sellerId,
      file,
      dto.type,
      dto.sortOrder,
    );
  }
}
