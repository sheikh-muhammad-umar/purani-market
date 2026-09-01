import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { AdvertisingService } from './advertising.service.js';
import { AdCampaignStatus, AdPlacement } from './advertising.enums.js';
import {
  CreateAdvertiserDto,
  UpdateAdvertiserDto,
} from './dto/advertiser.dto.js';
import {
  CreateAdCampaignDto,
  UpdateAdCampaignDto,
} from './dto/ad-campaign.dto.js';
import {
  CreateAdCreativeDto,
  UpdateAdCreativeDto,
} from './dto/ad-creative.dto.js';

/**
 * Staff-facing management of the ad inventory.
 *
 * Kept separate from the public delivery controller so the admin surface can be
 * guarded wholesale and never accidentally exposed.
 */
@Controller('api/admin/ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdvertisingAdminController {
  constructor(
    private readonly advertisingService: AdvertisingService,
    private readonly tracker: AdminTrackerService,
  ) {}

  // ── Advertisers ───────────────────────────────────────────────────

  @Get('advertisers')
  async listAdvertisers(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit === undefined ? undefined : Number(limit);
    return this.advertisingService.listAdvertisers(
      search,
      parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Get('advertisers/:id')
  async getAdvertiser(@Param('id') id: string) {
    return this.advertisingService.getAdvertiser(id);
  }

  @Post('advertisers')
  async createAdvertiser(
    @Body() dto: CreateAdvertiserDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const advertiser = await this.advertisingService.createAdvertiser(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_ADVERTISER_CREATE,
      { advertiserId: advertiser._id.toString(), name: advertiser.name },
      req,
    );
    return advertiser;
  }

  @Patch('advertisers/:id')
  async updateAdvertiser(
    @Param('id') id: string,
    @Body() dto: UpdateAdvertiserDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const advertiser = await this.advertisingService.updateAdvertiser(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_ADVERTISER_UPDATE,
      { advertiserId: id, changes: dto },
      req,
    );
    return advertiser;
  }

  @Delete('advertisers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdvertiser(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.advertisingService.deleteAdvertiser(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_ADVERTISER_DELETE,
      { advertiserId: id },
      req,
    );
  }

  // ── Campaigns ─────────────────────────────────────────────────────

  @Get('campaigns')
  async listCampaigns(
    @Query('advertiserId') advertiserId?: string,
    @Query('status') status?: AdCampaignStatus,
    @Query('placement') placement?: AdPlacement,
  ) {
    return this.advertisingService.listCampaigns({
      advertiserId,
      status,
      placement,
    });
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id') id: string) {
    return this.advertisingService.getCampaign(id);
  }

  @Post('campaigns')
  async createCampaign(
    @Body() dto: CreateAdCampaignDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const campaign = await this.advertisingService.createCampaign(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CAMPAIGN_CREATE,
      { campaignId: campaign._id.toString(), name: campaign.name },
      req,
    );
    return campaign;
  }

  @Patch('campaigns/:id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateAdCampaignDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const campaign = await this.advertisingService.updateCampaign(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CAMPAIGN_UPDATE,
      { campaignId: id, changes: dto },
      req,
    );
    return campaign;
  }

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCampaign(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.advertisingService.deleteCampaign(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CAMPAIGN_DELETE,
      { campaignId: id },
      req,
    );
  }

  // ── Creatives ─────────────────────────────────────────────────────

  @Get('campaigns/:id/creatives')
  async listCreatives(@Param('id') id: string) {
    return this.advertisingService.listCreatives(id);
  }

  @Post('creatives')
  async createCreative(
    @Body() dto: CreateAdCreativeDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const creative = await this.advertisingService.createCreative(dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CREATIVE_CREATE,
      { creativeId: creative._id.toString(), campaignId: dto.campaignId },
      req,
    );
    return creative;
  }

  @Patch('creatives/:id')
  async updateCreative(
    @Param('id') id: string,
    @Body() dto: UpdateAdCreativeDto,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    const creative = await this.advertisingService.updateCreative(id, dto);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CREATIVE_UPDATE,
      { creativeId: id, changes: dto },
      req,
    );
    return creative;
  }

  @Delete('creatives/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCreative(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Req() req: any,
  ) {
    await this.advertisingService.deleteCreative(id);
    this.tracker.track(
      adminId,
      UserAction.ADMIN_AD_CREATIVE_DELETE,
      { creativeId: id },
      req,
    );
  }

  // ── Reporting ─────────────────────────────────────────────────────

  @Get('performance')
  async getPerformance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.advertisingService.getPerformance(from, to);
  }

  /** Manual trigger for the schedule sweep, so staff need not wait for the cron. */
  @Post('sync-statuses')
  async syncStatuses() {
    return this.advertisingService.syncCampaignStatuses();
  }
}
