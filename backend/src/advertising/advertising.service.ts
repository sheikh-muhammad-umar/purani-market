import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema.js';
import {
  AdCampaignStatus,
  AdDevice,
  AdEventType,
  AdPlacement,
} from './advertising.enums.js';
import {
  AdCampaign,
  AdCampaignDocument,
} from './schemas/ad-campaign.schema.js';
import {
  AdCreative,
  AdCreativeDocument,
} from './schemas/ad-creative.schema.js';
import { AdEvent, AdEventDocument } from './schemas/ad-event.schema.js';
import { UserAction } from '../ai/enums/user-action.enum.js';
import { Advertiser, AdvertiserDocument } from './schemas/advertiser.schema.js';
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
import { RecordAdEventDto, ServeAdQueryDto } from './dto/serve-ad.dto.js';

/** A creative prepared for rendering, with just what the client needs. */
export interface ServedAd {
  creativeId: string;
  campaignId: string;
  placement: AdPlacement;
  title: string;
  body?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  destinationUrl?: string;
  routeLink?: string;
  ctaLabel?: string;
  advertiserName?: string;
}

/** Aggregated delivery for one campaign or creative. */
export interface AdPerformanceRow {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

/** What a campaign's clicks led to, per campaign. */
export interface AdConversionRow {
  campaignId: string;
  name: string;
  clicks: number;
  /** Clicks followed by at least one valuable action in the same session. */
  convertedClicks: number;
  /** `convertedClicks` as a percentage of `clicks`, to 2dp. */
  conversionRate: number;
  /** Which actions followed, most frequent first. */
  actions: { action: string; count: number }[];
}

export interface AdPerformanceReport {
  from: string;
  to: string;
  totals: { impressions: number; clicks: number; ctr: number };
  campaigns: AdPerformanceRow[];
  creatives: AdPerformanceRow[];
  daily: { date: string; impressions: number; clicks: number }[];
  /**
   * Post-click outcomes.
   *
   * Answers what advertisers actually ask — not "how many clicks" but "did the
   * clicks do anything" — by matching a click to what the same session did
   * afterwards. Empty when nothing was clicked in the window.
   */
  conversions: {
    window: string;
    countedActions: string[];
    totals: { clicks: number; convertedClicks: number; conversionRate: number };
    campaigns: AdConversionRow[];
  };
}

/** How far up the category tree targeting is honoured. */
const MAX_CATEGORY_DEPTH = 10;

/** Collection holding the behavioural stream that clicks are attributed against. */
const ACTIVITY_COLLECTION = 'user_activities';

/**
 * How long after a click an action still counts as caused by it.
 *
 * Session ids are per tab, so they already bound this loosely — but a tab left
 * open for days would otherwise keep attributing, which would flatter every
 * campaign. A day is the usual convention for post-click attribution.
 */
const ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Actions that count as a conversion.
 *
 * Chosen as the outcomes an advertiser is paying for: reaching a seller, saving
 * a listing, signing up, or spending money. Deliberately excludes browsing —
 * a click that leads only to a page view has not converted.
 */
const CONVERSION_ACTIONS: readonly UserAction[] = [
  UserAction.CONTACT,
  UserAction.MESSAGE_SENT,
  UserAction.CONVERSATION_START,
  UserAction.FAVORITE,
  UserAction.REGISTER,
  UserAction.PACKAGE_PURCHASE,
  UserAction.LISTING_CREATE,
];

@Injectable()
export class AdvertisingService {
  private readonly logger = new Logger(AdvertisingService.name);

  constructor(
    @InjectModel(Advertiser.name)
    private readonly advertiserModel: Model<AdvertiserDocument>,
    @InjectModel(AdCampaign.name)
    private readonly campaignModel: Model<AdCampaignDocument>,
    @InjectModel(AdCreative.name)
    private readonly creativeModel: Model<AdCreativeDocument>,
    @InjectModel(AdEvent.name)
    private readonly eventModel: Model<AdEventDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  // ── Serving ───────────────────────────────────────────────────────

  /**
   * Picks the ads to fill one slot.
   *
   * Returns an empty array rather than throwing when nothing is eligible: an
   * unsold slot is a normal state, and the client collapses the slot so the
   * layout never shows a gap.
   */
  async serve(query: ServeAdQueryDto): Promise<ServedAd[]> {
    const limit = query.limit ?? 1;
    const now = new Date();

    const campaigns = await this.findEligibleCampaigns(query, now);
    if (campaigns.length === 0) return [];

    const deliverable = await this.dropCampaignsOverDailyCap(campaigns, now);
    if (deliverable.length === 0) return [];

    const campaignById = new Map(
      deliverable.map((campaign) => [campaign._id.toString(), campaign]),
    );

    const creatives = await this.creativeModel
      .find({
        campaignId: { $in: deliverable.map((campaign) => campaign._id) },
        placement: query.placement,
        isActive: true,
      })
      .lean()
      .exec();
    if (creatives.length === 0) return [];

    // A creative's chance combines its own rotation weight with its campaign's
    // priority, so a high-priority campaign wins more often without starving
    // the rest outright.
    const weighted = creatives.map((creative) => {
      const campaign = campaignById.get(creative.campaignId.toString());
      return {
        creative,
        weight:
          Math.max(1, creative.weight) * Math.max(1, campaign?.priority ?? 1),
      };
    });

    const picked = this.pickWeighted(weighted, limit);
    const advertiserNames = await this.resolveAdvertiserNames(
      picked.map((creative) =>
        campaignById.get(creative.campaignId.toString()),
      ),
    );

    return picked.map((creative) => {
      const campaign = campaignById.get(creative.campaignId.toString());
      return {
        creativeId: creative._id.toString(),
        campaignId: creative.campaignId.toString(),
        placement: creative.placement,
        title: creative.title,
        body: creative.body,
        imageUrl: creative.imageUrl,
        mobileImageUrl: creative.mobileImageUrl,
        altText: creative.altText,
        destinationUrl: creative.destinationUrl,
        routeLink: creative.routeLink,
        ctaLabel: creative.ctaLabel,
        advertiserName: campaign
          ? advertiserNames.get(campaign.advertiserId.toString())
          : undefined,
      };
    });
  }

  /**
   * Campaigns that are live, target this placement, and match the visitor's
   * category, location and device.
   */
  private async findEligibleCampaigns(
    query: ServeAdQueryDto,
    now: Date,
  ): Promise<AdCampaignDocument[]> {
    const filter: Record<string, any> = {
      status: AdCampaignStatus.ACTIVE,
      startAt: { $lte: now },
      endAt: { $gte: now },
      'targeting.placements': query.placement,
    };

    // An empty targeting array means "no restriction", so each dimension matches
    // when it is empty OR contains the visitor's value.
    if (query.categoryId) {
      const lineage = await this.resolveCategoryLineage(query.categoryId);
      filter['$and'] = [
        ...((filter['$and'] as Record<string, any>[]) ?? []),
        {
          $or: [
            { 'targeting.categoryIds': { $size: 0 } },
            { 'targeting.categoryIds': { $in: lineage } },
          ],
        },
      ];
    } else {
      filter['targeting.categoryIds'] = { $size: 0 };
    }

    this.applyOptionalTargeting(
      filter,
      'targeting.provinceIds',
      query.provinceId,
    );
    this.applyOptionalTargeting(filter, 'targeting.cityIds', query.cityId);

    if (query.device) {
      filter['$and'] = [
        ...((filter['$and'] as Record<string, any>[]) ?? []),
        {
          $or: [
            { 'targeting.devices': { $size: 0 } },
            { 'targeting.devices': query.device as AdDevice },
          ],
        },
      ];
    }

    const campaigns = await this.campaignModel.find(filter).exec();

    // Lifetime caps are enforced here as well as by the cron, so a campaign that
    // hits its ceiling between runs stops immediately.
    return campaigns.filter(
      (campaign) => !this.hasReachedLifetimeCap(campaign),
    );
  }

  /**
   * Adds a "no restriction OR matches" clause for a targeting dimension.
   * When the visitor has no value for it, only unrestricted campaigns qualify.
   */
  private applyOptionalTargeting(
    filter: Record<string, any>,
    field: string,
    value?: string,
  ): void {
    if (!value) {
      filter[field] = { $size: 0 };
      return;
    }
    filter['$and'] = [
      ...((filter['$and'] as Record<string, any>[]) ?? []),
      {
        $or: [
          { [field]: { $size: 0 } },
          { [field]: new Types.ObjectId(value) },
        ],
      },
    ];
  }

  /** The category plus its ancestors, so targeting a parent covers its children. */
  private async resolveCategoryLineage(
    categoryId: string,
  ): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(categoryId)) return [];

    const lineage: Types.ObjectId[] = [];
    let current = await this.categoryModel.findById(categoryId).lean().exec();
    let depth = 0;

    while (current && depth < MAX_CATEGORY_DEPTH) {
      lineage.push(current._id);
      if (!current.parentId) break;
      current = await this.categoryModel
        .findById(current.parentId)
        .lean()
        .exec();
      depth++;
    }
    return lineage;
  }

  private hasReachedLifetimeCap(campaign: AdCampaignDocument): boolean {
    const { maxImpressions, maxClicks } = campaign;
    const { impressions, clicks } = campaign.metrics ?? {
      impressions: 0,
      clicks: 0,
    };
    if (maxImpressions > 0 && impressions >= maxImpressions) return true;
    if (maxClicks > 0 && clicks >= maxClicks) return true;
    return false;
  }

  /**
   * Removes campaigns that already hit today's impression ceiling.
   *
   * Only campaigns that actually set a daily cap are counted, so the common case
   * costs no extra queries.
   */
  private async dropCampaignsOverDailyCap(
    campaigns: AdCampaignDocument[],
    now: Date,
  ): Promise<AdCampaignDocument[]> {
    const capped = campaigns.filter(
      (campaign) => campaign.dailyImpressionCap > 0,
    );
    if (capped.length === 0) return campaigns;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const counts = await this.eventModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      {
        $match: {
          campaignId: { $in: capped.map((campaign) => campaign._id) },
          type: AdEventType.IMPRESSION,
          createdAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: '$campaignId', count: { $sum: 1 } } },
    ]);

    const todayByCampaign = new Map(
      counts.map((row) => [row._id.toString(), row.count]),
    );

    return campaigns.filter((campaign) => {
      if (campaign.dailyImpressionCap <= 0) return true;
      const delivered = todayByCampaign.get(campaign._id.toString()) ?? 0;
      return delivered < campaign.dailyImpressionCap;
    });
  }

  /**
   * Picks up to `limit` distinct entries, each chosen with probability
   * proportional to its weight.
   */
  private pickWeighted(
    entries: { creative: AdCreative; weight: number }[],
    limit: number,
  ): AdCreative[] {
    const pool = [...entries];
    const picked: AdCreative[] = [];

    while (pool.length > 0 && picked.length < limit) {
      const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
      let cursor = this.randomFloat() * total;

      let index = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        cursor -= pool[i].weight;
        if (cursor <= 0) {
          index = i;
          break;
        }
      }

      picked.push(pool[index].creative);
      pool.splice(index, 1);
    }
    return picked;
  }

  /** Seam for deterministic selection in tests. */
  protected randomFloat(): number {
    return Math.random();
  }

  private async resolveAdvertiserNames(
    campaigns: (AdCampaignDocument | undefined)[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        campaigns
          .filter((campaign): campaign is AdCampaignDocument => !!campaign)
          .map((campaign) => campaign.advertiserId.toString()),
      ),
    ];
    if (ids.length === 0) return new Map();

    const advertisers = await this.advertiserModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select({ name: 1 })
      .lean()
      .exec();

    return new Map(
      advertisers.map((advertiser) => [
        advertiser._id.toString(),
        advertiser.name,
      ]),
    );
  }

  // ── Tracking ──────────────────────────────────────────────────────

  /**
   * Records an impression or click.
   *
   * Impressions are collapsed per session so scrolling a slot back into view
   * does not inflate delivery; clicks are always recorded because a repeat click
   * is a real second visit for the advertiser.
   */
  async recordEvent(
    creativeId: string,
    dto: RecordAdEventDto,
    userId?: string,
  ): Promise<{ recorded: boolean }> {
    if (!Types.ObjectId.isValid(creativeId)) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const creative = await this.creativeModel.findById(creativeId).exec();
    if (!creative) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    if (dto.type === AdEventType.IMPRESSION && dto.sessionId) {
      const seen = await this.eventModel
        .exists({
          creativeId: creative._id,
          sessionId: dto.sessionId,
          type: AdEventType.IMPRESSION,
        })
        .exec();
      if (seen) return { recorded: false };
    }

    await this.eventModel.create({
      creativeId: creative._id,
      campaignId: creative.campaignId,
      type: dto.type,
      placement: dto.placement,
      sessionId: dto.sessionId,
      userId:
        userId && Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : undefined,
    });

    const field =
      dto.type === AdEventType.IMPRESSION
        ? 'metrics.impressions'
        : 'metrics.clicks';

    await Promise.all([
      this.creativeModel
        .updateOne({ _id: creative._id }, { $inc: { [field]: 1 } })
        .exec(),
      this.campaignModel
        .updateOne({ _id: creative.campaignId }, { $inc: { [field]: 1 } })
        .exec(),
    ]);

    await this.completeIfCapReached(creative.campaignId);
    return { recorded: true };
  }

  /** Ends a campaign as soon as a lifetime cap is met, without waiting for the cron. */
  private async completeIfCapReached(
    campaignId: Types.ObjectId,
  ): Promise<void> {
    const campaign = await this.campaignModel.findById(campaignId).exec();
    if (!campaign || campaign.status !== AdCampaignStatus.ACTIVE) return;
    if (!this.hasReachedLifetimeCap(campaign)) return;

    campaign.status = AdCampaignStatus.COMPLETED;
    await campaign.save();
    this.logger.log(
      `Campaign ${campaign._id.toString()} completed: delivery cap reached`,
    );
  }

  // ── Scheduling ────────────────────────────────────────────────────

  /**
   * Moves campaigns through their schedule.
   *
   * Runs hourly rather than on every request so serving stays a read path; the
   * serving filter also checks the window, so a campaign is never served outside
   * its dates even between runs.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncCampaignStatuses(): Promise<{
    activated: number;
    completed: number;
  }> {
    const now = new Date();

    const activated = await this.campaignModel
      .updateMany(
        {
          status: AdCampaignStatus.SCHEDULED,
          startAt: { $lte: now },
          endAt: { $gte: now },
        },
        { $set: { status: AdCampaignStatus.ACTIVE } },
      )
      .exec();

    const completed = await this.campaignModel
      .updateMany(
        {
          status: {
            $in: [AdCampaignStatus.ACTIVE, AdCampaignStatus.SCHEDULED],
          },
          endAt: { $lt: now },
        },
        { $set: { status: AdCampaignStatus.COMPLETED } },
      )
      .exec();

    if (activated.modifiedCount || completed.modifiedCount) {
      this.logger.log(
        `Campaign statuses synced: ${activated.modifiedCount} activated, ${completed.modifiedCount} completed`,
      );
    }
    return {
      activated: activated.modifiedCount,
      completed: completed.modifiedCount,
    };
  }

  // ── Advertisers ───────────────────────────────────────────────────

  async listAdvertisers(search?: string): Promise<AdvertiserDocument[]> {
    const filter: Record<string, any> = {};
    if (search?.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }
    return this.advertiserModel.find(filter).sort({ name: 1 }).exec();
  }

  async getAdvertiser(id: string): Promise<AdvertiserDocument> {
    const advertiser = Types.ObjectId.isValid(id)
      ? await this.advertiserModel.findById(id).exec()
      : null;
    if (!advertiser) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return advertiser;
  }

  async createAdvertiser(
    dto: CreateAdvertiserDto,
  ): Promise<AdvertiserDocument> {
    return this.advertiserModel.create(dto);
  }

  async updateAdvertiser(
    id: string,
    dto: UpdateAdvertiserDto,
  ): Promise<AdvertiserDocument> {
    const advertiser = await this.getAdvertiser(id);
    Object.assign(advertiser, dto);
    return advertiser.save();
  }

  /**
   * Removes an advertiser, refusing while campaigns still reference it so
   * reporting never points at a missing brand.
   */
  async deleteAdvertiser(id: string): Promise<void> {
    const advertiser = await this.getAdvertiser(id);
    const campaigns = await this.campaignModel
      .countDocuments({ advertiserId: advertiser._id })
      .exec();
    if (campaigns > 0) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    await this.advertiserModel.deleteOne({ _id: advertiser._id }).exec();
  }

  // ── Campaigns ─────────────────────────────────────────────────────

  async listCampaigns(filters: {
    advertiserId?: string;
    status?: AdCampaignStatus;
    placement?: AdPlacement;
  }): Promise<AdCampaignDocument[]> {
    const filter: Record<string, any> = {};
    if (filters.advertiserId && Types.ObjectId.isValid(filters.advertiserId)) {
      filter.advertiserId = new Types.ObjectId(filters.advertiserId);
    }
    if (filters.status) filter.status = filters.status;
    if (filters.placement) filter['targeting.placements'] = filters.placement;
    return this.campaignModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async getCampaign(id: string): Promise<AdCampaignDocument> {
    const campaign = Types.ObjectId.isValid(id)
      ? await this.campaignModel.findById(id).exec()
      : null;
    if (!campaign) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    return campaign;
  }

  async createCampaign(dto: CreateAdCampaignDto): Promise<AdCampaignDocument> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.assertValidWindow(startAt, endAt);
    await this.getAdvertiser(dto.advertiserId);

    return this.campaignModel.create({
      ...dto,
      advertiserId: new Types.ObjectId(dto.advertiserId),
      startAt,
      endAt,
      targeting: this.toTargeting(dto.targeting),
    });
  }

  async updateCampaign(
    id: string,
    dto: UpdateAdCampaignDto,
  ): Promise<AdCampaignDocument> {
    const campaign = await this.getCampaign(id);

    const startAt = dto.startAt ? new Date(dto.startAt) : campaign.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : campaign.endAt;
    this.assertValidWindow(startAt, endAt);

    if (dto.advertiserId) {
      await this.getAdvertiser(dto.advertiserId);
      campaign.advertiserId = new Types.ObjectId(dto.advertiserId);
    }

    const { targeting, advertiserId, ...rest } = dto;
    void advertiserId;
    Object.assign(campaign, rest, { startAt, endAt });
    if (targeting) campaign.targeting = this.toTargeting(targeting);

    return campaign.save();
  }

  /** Deletes a campaign together with its creatives, keeping no orphans. */
  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.getCampaign(id);
    await this.creativeModel.deleteMany({ campaignId: campaign._id }).exec();
    await this.campaignModel.deleteOne({ _id: campaign._id }).exec();
  }

  private assertValidWindow(startAt: Date, endAt: Date): void {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
    if (endAt <= startAt) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
  }

  private toTargeting(targeting: {
    placements: AdPlacement[];
    categoryIds?: string[];
    provinceIds?: string[];
    cityIds?: string[];
    devices?: AdDevice[];
  }) {
    const toObjectIds = (ids?: string[]) =>
      (ids ?? [])
        .filter(Types.ObjectId.isValid)
        .map((id) => new Types.ObjectId(id));

    return {
      placements: targeting.placements,
      categoryIds: toObjectIds(targeting.categoryIds),
      provinceIds: toObjectIds(targeting.provinceIds),
      cityIds: toObjectIds(targeting.cityIds),
      devices: targeting.devices ?? [],
    };
  }

  // ── Creatives ─────────────────────────────────────────────────────

  async listCreatives(campaignId: string): Promise<AdCreativeDocument[]> {
    const campaign = await this.getCampaign(campaignId);
    return this.creativeModel
      .find({ campaignId: campaign._id })
      .sort({ createdAt: -1 })
      .exec();
  }

  async createCreative(dto: CreateAdCreativeDto): Promise<AdCreativeDocument> {
    const campaign = await this.getCampaign(dto.campaignId);
    this.assertSingleDestination(dto.destinationUrl, dto.routeLink);
    this.assertPlacementAllowed(campaign, dto.placement);

    return this.creativeModel.create({
      ...dto,
      campaignId: campaign._id,
    });
  }

  async updateCreative(
    id: string,
    dto: UpdateAdCreativeDto,
  ): Promise<AdCreativeDocument> {
    const creative = Types.ObjectId.isValid(id)
      ? await this.creativeModel.findById(id).exec()
      : null;
    if (!creative) throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);

    const destinationUrl =
      dto.destinationUrl !== undefined
        ? dto.destinationUrl
        : creative.destinationUrl;
    const routeLink =
      dto.routeLink !== undefined ? dto.routeLink : creative.routeLink;
    this.assertSingleDestination(destinationUrl, routeLink);

    if (dto.placement) {
      const campaign = await this.getCampaign(creative.campaignId.toString());
      this.assertPlacementAllowed(campaign, dto.placement);
    }

    Object.assign(creative, dto);
    return creative.save();
  }

  async deleteCreative(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const result = await this.creativeModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
  }

  /**
   * Exactly one destination must be set: an ad with neither is not clickable,
   * and one with both is ambiguous at render time.
   */
  private assertSingleDestination(
    destinationUrl?: string,
    routeLink?: string,
  ): void {
    const hasExternal = !!destinationUrl?.trim();
    const hasInternal = !!routeLink?.trim();
    if (hasExternal === hasInternal) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
  }

  /** A creative cannot occupy a placement its campaign did not buy. */
  private assertPlacementAllowed(
    campaign: AdCampaignDocument,
    placement: AdPlacement,
  ): void {
    if (!campaign.targeting?.placements?.includes(placement)) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }
  }

  // ── Reporting ─────────────────────────────────────────────────────

  /**
   * Delivery over a date range, broken down by campaign, creative and day.
   *
   * Built from the event rows rather than the denormalised counters, because
   * those counters are lifetime totals and cannot answer "last week".
   */
  async getPerformance(
    fromInput?: string,
    toInput?: string,
  ): Promise<AdPerformanceReport> {
    const to = toInput ? new Date(toInput) : new Date();
    const from = fromInput
      ? new Date(fromInput)
      : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const match = { createdAt: { $gte: from, $lte: to } };

    const [byCampaign, byCreative, daily] = await Promise.all([
      this.eventModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$campaignId',
            impressions: this.countOf(AdEventType.IMPRESSION),
            clicks: this.countOf(AdEventType.CLICK),
          },
        },
      ]),
      this.eventModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$creativeId',
            impressions: this.countOf(AdEventType.IMPRESSION),
            clicks: this.countOf(AdEventType.CLICK),
          },
        },
      ]),
      this.eventModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            impressions: this.countOf(AdEventType.IMPRESSION),
            clicks: this.countOf(AdEventType.CLICK),
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const [campaignNames, creativeNames] = await Promise.all([
      this.namesFor(this.campaignModel, byCampaign),
      this.namesFor(this.creativeModel, byCreative),
    ]);

    const campaigns = this.toRows(byCampaign, campaignNames);
    const creatives = this.toRows(byCreative, creativeNames);
    const impressions = campaigns.reduce(
      (sum, row) => sum + row.impressions,
      0,
    );
    const clicks = campaigns.reduce((sum, row) => sum + row.clicks, 0);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: { impressions, clicks, ctr: this.ctr(impressions, clicks) },
      campaigns: campaigns.sort((a, b) => b.impressions - a.impressions),
      creatives: creatives.sort((a, b) => b.impressions - a.impressions),
      daily: daily.map((row: any) => ({
        date: row._id as string,
        impressions: row.impressions as number,
        clicks: row.clicks as number,
      })),
      conversions: await this.getConversions(from, to, campaignNames),
    };
  }

  /**
   * Matches each click to what the same browser session did next.
   *
   * The join is on `sessionId`, which is why activity, ad and experiment events
   * were put on one shared id: without it a click and the contact it produced
   * were two unrelated rows in two collections.
   *
   * Runs as one aggregation rather than fetching clicks and querying per click,
   * because a busy campaign produces enough clicks for the round trips to
   * dominate. Both sides of the lookup are indexed on `sessionId`.
   */
  private async getConversions(
    from: Date,
    to: Date,
    campaignNames: Map<string, string>,
  ): Promise<AdPerformanceReport['conversions']> {
    const rows: {
      _id: Types.ObjectId;
      clicks: number;
      convertedClicks: number;
      actions: string[];
    }[] = await this.eventModel.aggregate([
      {
        $match: {
          type: AdEventType.CLICK,
          createdAt: { $gte: from, $lte: to },
          // Anonymous clicks with storage disabled carry no session and cannot
          // be attributed either way, so they are left out of the denominator.
          sessionId: { $type: 'string' },
        },
      },
      {
        $lookup: {
          from: ACTIVITY_COLLECTION,
          let: { sid: '$sessionId', clickedAt: '$createdAt' },
          pipeline: [
            {
              $match: {
                action: { $in: CONVERSION_ACTIONS },
                $expr: {
                  $and: [
                    { $eq: ['$sessionId', '$$sid'] },
                    { $gt: ['$createdAt', '$$clickedAt'] },
                    {
                      $lte: [
                        { $subtract: ['$createdAt', '$$clickedAt'] },
                        ATTRIBUTION_WINDOW_MS,
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { _id: 0, action: 1 } },
          ],
          as: 'followed',
        },
      },
      {
        $group: {
          _id: '$campaignId',
          clicks: { $sum: 1 },
          convertedClicks: {
            $sum: { $cond: [{ $gt: [{ $size: '$followed' }, 0] }, 1, 0] },
          },
          actions: { $push: '$followed.action' },
        },
      },
    ]);

    const campaigns: AdConversionRow[] = rows.map((row) => {
      // Two levels of nesting: one array per click, each holding that click's
      // follow-up actions.
      const counts = new Map<string, number>();
      for (const perClick of row.actions ?? []) {
        for (const action of perClick ?? []) {
          counts.set(action, (counts.get(action) ?? 0) + 1);
        }
      }
      const id = row._id?.toString() ?? '';
      return {
        campaignId: id,
        name: campaignNames.get(id) ?? 'Unknown',
        clicks: row.clicks,
        convertedClicks: row.convertedClicks,
        conversionRate: this.ctr(row.clicks, row.convertedClicks),
        actions: [...counts.entries()]
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count),
      };
    });

    const clicks = campaigns.reduce((sum, row) => sum + row.clicks, 0);
    const convertedClicks = campaigns.reduce(
      (sum, row) => sum + row.convertedClicks,
      0,
    );

    return {
      window: `${ATTRIBUTION_WINDOW_MS / (60 * 60 * 1000)}h`,
      countedActions: [...CONVERSION_ACTIONS],
      totals: {
        clicks,
        convertedClicks,
        conversionRate: this.ctr(clicks, convertedClicks),
      },
      campaigns: campaigns.sort(
        (a, b) => b.convertedClicks - a.convertedClicks,
      ),
    };
  }

  private countOf(type: AdEventType) {
    return { $sum: { $cond: [{ $eq: ['$type', type] }, 1, 0] } };
  }

  private async namesFor(
    model: Model<any>,
    rows: { _id: Types.ObjectId }[],
  ): Promise<Map<string, string>> {
    if (rows.length === 0) return new Map();
    const docs = await model
      .find({ _id: { $in: rows.map((row) => row._id) } })
      .select({ name: 1, title: 1 })
      .lean()
      .exec();
    return new Map(
      docs.map((doc: any) => [
        doc._id.toString(),
        (doc.name ?? doc.title ?? '') as string,
      ]),
    );
  }

  private toRows(
    rows: { _id: Types.ObjectId; impressions: number; clicks: number }[],
    names: Map<string, string>,
  ): AdPerformanceRow[] {
    return rows.map((row) => {
      const id = row._id.toString();
      return {
        id,
        name: names.get(id) || id,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: this.ctr(row.impressions, row.clicks),
      };
    });
  }

  private ctr(impressions: number, clicks: number): number {
    if (impressions <= 0) return 0;
    return Math.round((clicks / impressions) * 10000) / 100;
  }
}
