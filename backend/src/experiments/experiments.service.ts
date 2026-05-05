import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import {
  Experiment,
  ExperimentDocument,
  ExperimentStatus,
  ExperimentVariant,
} from './schemas/experiment.schema.js';
import {
  ExperimentEvent,
  ExperimentEventDocument,
  ExperimentEventType,
} from './schemas/experiment-event.schema.js';

export { ExperimentEventType } from './schemas/experiment-event.schema.js';

export interface VariantAssignment {
  experimentKey: string;
  variantId: string;
  config: Record<string, any>;
}

export interface ExperimentMetrics {
  experimentKey: string;
  experimentName: string;
  status: ExperimentStatus;
  variants: VariantMetrics[];
  startedAt?: Date;
  totalSubjects: number;
}

export interface VariantMetrics {
  variantId: string;
  variantName: string;
  weight: number;
  subjects: number;
  impressions: number;
  clicks: number;
  ctr: number; // click-through rate
  favorites: number;
  contacts: number;
  conversions: number;
  avgClickPosition: number;
}

@Injectable()
export class ExperimentsService {
  /** In-memory cache of running experiments (refreshed periodically) */
  private runningExperiments: ExperimentDocument[] = [];
  private lastRefresh = 0;
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @InjectModel(Experiment.name)
    private readonly experimentModel: Model<ExperimentDocument>,
    @InjectModel(ExperimentEvent.name)
    private readonly eventModel: Model<ExperimentEventDocument>,
  ) {}

  // ── Assignment ────────────────────────────────────────────────

  /**
   * Get all variant assignments for a subject (user or visitor).
   * Uses deterministic hashing so the same subject always gets the same variant.
   */
  async getAssignments(subjectId: string): Promise<VariantAssignment[]> {
    const experiments = await this.getRunningExperiments();
    return experiments.map((exp) => {
      const variant = this.assignVariant(subjectId, exp.key, exp.variants);
      return {
        experimentKey: exp.key,
        variantId: variant.id,
        config: variant.config,
      };
    });
  }

  /**
   * Get assignment for a specific experiment.
   */
  async getAssignment(
    subjectId: string,
    experimentKey: string,
  ): Promise<VariantAssignment | null> {
    const experiments = await this.getRunningExperiments();
    const exp = experiments.find((e) => e.key === experimentKey);
    if (!exp) return null;
    const variant = this.assignVariant(subjectId, exp.key, exp.variants);
    return {
      experimentKey: exp.key,
      variantId: variant.id,
      config: variant.config,
    };
  }

  /**
   * Deterministic variant assignment using consistent hashing.
   * Same subject + experiment always gets the same variant.
   */
  private assignVariant(
    subjectId: string,
    experimentKey: string,
    variants: ExperimentVariant[],
  ): ExperimentVariant {
    const hash = createHash('md5')
      .update(`${experimentKey}:${subjectId}`)
      .digest();
    // Use first 4 bytes as a number (0 to 4294967295), normalize to 0-100
    const bucket = (hash.readUInt32BE(0) % 10000) / 100; // 0.00 to 99.99

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant;
      }
    }
    // Fallback (shouldn't happen if weights sum to 100)
    return variants[variants.length - 1];
  }

  // ── Event Tracking ────────────────────────────────────────────

  async trackEvent(
    experimentKey: string,
    variantId: string,
    eventType: ExperimentEventType,
    subjectId: string,
    data?: {
      searchQuery?: string;
      listingId?: string;
      position?: number;
      totalResults?: number;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    await this.eventModel.create({
      experimentKey,
      variantId,
      eventType,
      subjectId,
      searchQuery: data?.searchQuery,
      listingId: data?.listingId
        ? new Types.ObjectId(data.listingId)
        : undefined,
      position: data?.position,
      totalResults: data?.totalResults,
      metadata: data?.metadata,
    });
  }

  // ── Analytics ─────────────────────────────────────────────────

  async getMetrics(experimentKey: string): Promise<ExperimentMetrics> {
    const experiment = await this.experimentModel
      .findOne({ key: experimentKey })
      .lean()
      .exec();
    if (!experiment) {
      throw new NotFoundException(`Experiment "${experimentKey}" not found`);
    }

    const pipeline = [
      { $match: { experimentKey } },
      {
        $group: {
          _id: { variantId: '$variantId', eventType: '$eventType' },
          count: { $sum: 1 },
          uniqueSubjects: { $addToSet: '$subjectId' },
          avgPosition: { $avg: '$position' },
        },
      },
    ];

    const results = await this.eventModel.aggregate(pipeline).exec();

    // Build metrics per variant
    const variantMetrics: Map<string, VariantMetrics> = new Map();
    for (const variant of experiment.variants) {
      variantMetrics.set(variant.id, {
        variantId: variant.id,
        variantName: variant.name,
        weight: variant.weight,
        subjects: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        favorites: 0,
        contacts: 0,
        conversions: 0,
        avgClickPosition: 0,
      });
    }

    // Populate from aggregation results
    const subjectSets = new Map<string, Set<string>>();
    for (const row of results) {
      const { variantId, eventType } = row._id;
      const metrics = variantMetrics.get(variantId);
      if (!metrics) continue;

      if (!subjectSets.has(variantId)) subjectSets.set(variantId, new Set());
      for (const s of row.uniqueSubjects) subjectSets.get(variantId)!.add(s);

      switch (eventType) {
        case ExperimentEventType.SEARCH_IMPRESSION:
          metrics.impressions = row.count;
          break;
        case ExperimentEventType.SEARCH_CLICK:
          metrics.clicks = row.count;
          metrics.avgClickPosition = row.avgPosition ?? 0;
          break;
        case ExperimentEventType.SEARCH_FAVORITE:
          metrics.favorites = row.count;
          break;
        case ExperimentEventType.SEARCH_CONTACT:
          metrics.contacts = row.count;
          break;
        case ExperimentEventType.CONVERSION:
          metrics.conversions = row.count;
          break;
      }
    }

    // Calculate CTR and subject counts
    let totalSubjects = 0;
    for (const [variantId, metrics] of variantMetrics) {
      metrics.subjects = subjectSets.get(variantId)?.size ?? 0;
      metrics.ctr =
        metrics.impressions > 0
          ? Math.round((metrics.clicks / metrics.impressions) * 10000) / 100
          : 0;
      totalSubjects += metrics.subjects;
    }

    return {
      experimentKey: experiment.key,
      experimentName: experiment.name,
      status: experiment.status,
      variants: Array.from(variantMetrics.values()),
      startedAt: experiment.startedAt,
      totalSubjects,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────

  async create(data: {
    key: string;
    name: string;
    description?: string;
    variants: Array<{
      id: string;
      name: string;
      weight: number;
      config?: Record<string, any>;
    }>;
  }): Promise<ExperimentDocument> {
    return this.experimentModel.create({
      key: data.key,
      name: data.name,
      description: data.description,
      status: ExperimentStatus.DRAFT,
      variants: data.variants.map((v) => ({
        ...v,
        config: v.config || {},
      })),
    });
  }

  async start(key: string): Promise<ExperimentDocument> {
    const exp = await this.experimentModel
      .findOneAndUpdate(
        { key },
        { status: ExperimentStatus.RUNNING, startedAt: new Date() },
        { new: true },
      )
      .exec();
    if (!exp) throw new NotFoundException(`Experiment "${key}" not found`);
    this.lastRefresh = 0; // Force cache refresh
    return exp;
  }

  async pause(key: string): Promise<ExperimentDocument> {
    const exp = await this.experimentModel
      .findOneAndUpdate(
        { key },
        { status: ExperimentStatus.PAUSED },
        { new: true },
      )
      .exec();
    if (!exp) throw new NotFoundException(`Experiment "${key}" not found`);
    this.lastRefresh = 0;
    return exp;
  }

  async complete(key: string): Promise<ExperimentDocument> {
    const exp = await this.experimentModel
      .findOneAndUpdate(
        { key },
        { status: ExperimentStatus.COMPLETED, endedAt: new Date() },
        { new: true },
      )
      .exec();
    if (!exp) throw new NotFoundException(`Experiment "${key}" not found`);
    this.lastRefresh = 0;
    return exp;
  }

  async listAll(): Promise<ExperimentDocument[]> {
    return this.experimentModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  // ── Internal ──────────────────────────────────────────────────

  private async getRunningExperiments(): Promise<ExperimentDocument[]> {
    const now = Date.now();
    if (now - this.lastRefresh < ExperimentsService.CACHE_TTL_MS) {
      return this.runningExperiments;
    }
    this.runningExperiments = await this.experimentModel
      .find({ status: ExperimentStatus.RUNNING })
      .lean()
      .exec();
    this.lastRefresh = now;
    return this.runningExperiments;
  }
}
