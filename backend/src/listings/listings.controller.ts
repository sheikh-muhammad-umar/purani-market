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
    @Query('categoryId') categoryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('cityId') cityId?: string,
    @Query('areaId') areaId?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('area') area?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const sellerId = mine === 'true' && userId ? userId : undefined;
    return this.listingsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      sort || 'createdAt',
      order === 'asc' ? 'asc' : 'desc',
      sellerId,
      { categoryId, provinceId, cityId, areaId, province, city, area },
    );
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

    // Enrich with seller verification info for authenticated users only
    if (userId) {
      return {
        ...obj,
        sellerName: seller.sellerName,
        sellerEmailVerified: seller.emailVerified,
        sellerPhoneVerified: seller.phoneVerified,
        sellerIdVerified: seller.idVerified,
        sellerActiveAdsCount: seller.activeAdsCount,
        sellerResponseRate: seller.responseRate,
        sellerAvgResponseTime: seller.avgResponseTime,
      };
    }

    return { ...obj, sellerName: seller.sellerName };
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
