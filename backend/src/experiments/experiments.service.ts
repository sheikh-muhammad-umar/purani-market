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
  ctr: number; // click-through rate (clicks / impressions), percent
  favorites: number;
  contacts: number;
  conversions: number;
  avgClickPosition: number;
  /** Whether this variant is treated as the baseline for comparisons. */
  isControl: boolean;
  /**
   * Conversion rate = converting subjects / exposed subjects, as a percentage.
   * "Converting" counts distinct subjects with a CONVERSION event, so the rate
   * is bounded 0–100 and comparable across variants of different sizes.
   */
  conversionRate: number;
  /** Distinct subjects who fired at least one CONVERSION event. */
  convertedSubjects: number;
  /**
   * Relative change in conversion rate versus the control, as a percentage
   * (e.g. +12.5 means 12.5% better than control). Null for the control itself
   * or when the control has no conversion rate to compare against.
   */
  upliftVsControl: number | null;
  /**
   * Two-proportion z-test p-value for this variant's conversion rate against
   * the control. Null for the control or when there isn't enough data.
   */
  pValue: number | null;
  /** Confidence that the difference from control is real (100 - p*100), percent. */
  confidence: number | null;
  /** True when confidence ≥ 95% (p ≤ 0.05). */
  isSignificant: boolean;
}

export interface ExperimentAnalysis extends ExperimentMetrics {
  /** The variantId used as the control/baseline (first variant by default). */
  controlVariantId: string | null;
  /**
   * The recommended winner: the significant variant with the highest
   * conversion rate. Null when no variant reaches significance.
   */
  winnerVariantId: string | null;
  /** Date range the metrics were computed over, echoed back for the UI. */
  dateFrom?: string;
  dateTo?: string;
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
    // Guard the cast even though the DTO validates it: the service is also
    // callable from other modules, and `new Types.ObjectId(bad)` throws.
    const listingObjectId =
      data?.listingId && Types.ObjectId.isValid(data.listingId)
        ? new Types.ObjectId(data.listingId)
        : undefined;

    await this.eventModel.create({
      experimentKey,
      variantId,
      eventType,
      subjectId,
      searchQuery: data?.searchQuery,
      listingId: listingObjectId,
      position: data?.position,
      totalResults: data?.totalResults,
      metadata: data?.metadata,
    });
  }

  // ── Analytics ─────────────────────────────────────────────────

  /**
   * Detailed analysis for one experiment: per-variant funnel counts, unique
   * subjects, CTR, conversion rate, and — against the control variant — uplift,
   * a two-proportion z-test p-value, confidence, and a significance flag.
   *
   * `dateFrom`/`dateTo` (ISO strings) optionally scope the event window so an
   * admin can inspect a specific period; omitted, it covers all retained events.
   * The first variant is treated as the control unless `controlVariantId` is
   * given, matching how experiments are conventionally authored (control first).
   */
  async getMetrics(
    experimentKey: string,
    options?: { dateFrom?: string; dateTo?: string; controlVariantId?: string },
  ): Promise<ExperimentAnalysis> {
    const experiment = await this.experimentModel
      .findOne({ key: experimentKey })
      .lean()
      .exec();
    if (!experiment) {
      throw new NotFoundException(`Experiment "${experimentKey}" not found`);
    }

    const match: Record<string, any> = { experimentKey };
    const createdAt = this.buildDateRange(options?.dateFrom, options?.dateTo);
    if (createdAt) match.createdAt = createdAt;

    const pipeline = [
      { $match: match },
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

    // Determine the control variant up front so its rate can anchor comparisons.
    const controlVariantId =
      options?.controlVariantId ?? experiment.variants[0]?.id ?? null;

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
        isControl: variant.id === controlVariantId,
        conversionRate: 0,
        convertedSubjects: 0,
        upliftVsControl: null,
        pValue: null,
        confidence: null,
        isSignificant: false,
      });
    }

    // Distinct subjects across all events (exposure) and distinct converting
    // subjects, tracked separately so the conversion rate is per-subject.
    const subjectSets = new Map<string, Set<string>>();
    const convertedSets = new Map<string, Set<string>>();
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
          convertedSets.set(variantId, new Set(row.uniqueSubjects));
          break;
      }
    }

    // Calculate CTR, subject counts, and conversion rate.
    let totalSubjects = 0;
    for (const [variantId, metrics] of variantMetrics) {
      metrics.subjects = subjectSets.get(variantId)?.size ?? 0;
      metrics.convertedSubjects = convertedSets.get(variantId)?.size ?? 0;
      metrics.ctr = roundPct(metrics.clicks, metrics.impressions);
      metrics.conversionRate = roundPct(
        metrics.convertedSubjects,
        metrics.subjects,
      );
      totalSubjects += metrics.subjects;
    }

    // Significance vs control (two-proportion z-test on conversion).
    const control = controlVariantId
      ? variantMetrics.get(controlVariantId)
      : undefined;
    let winnerVariantId: string | null = null;
    let bestRate = control?.conversionRate ?? 0;

    if (control) {
      for (const metrics of variantMetrics.values()) {
        if (metrics.variantId === control.variantId) continue;

        metrics.upliftVsControl =
          control.conversionRate > 0
            ? Math.round(
                ((metrics.conversionRate - control.conversionRate) /
                  control.conversionRate) *
                  1000,
              ) / 10
            : null;

        const p = twoProportionPValue(
          metrics.convertedSubjects,
          metrics.subjects,
          control.convertedSubjects,
          control.subjects,
        );
        metrics.pValue = p;
        metrics.confidence =
          p === null ? null : Math.round((1 - p) * 1000) / 10;
        metrics.isSignificant = p !== null && p <= 0.05;

        // A winner must beat the control on conversion AND be significant.
        if (
          metrics.isSignificant &&
          metrics.conversionRate > bestRate &&
          metrics.conversionRate > control.conversionRate
        ) {
          bestRate = metrics.conversionRate;
          winnerVariantId = metrics.variantId;
        }
      }
    }

    return {
      experimentKey: experiment.key,
      experimentName: experiment.name,
      status: experiment.status,
      variants: Array.from(variantMetrics.values()),
      startedAt: experiment.startedAt,
      totalSubjects,
      controlVariantId,
      winnerVariantId,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
    };
  }

  /** Build a Mongo `createdAt` range from ISO date strings, or null if none. */
  private buildDateRange(
    dateFrom?: string,
    dateTo?: string,
  ): { $gte?: Date; $lte?: Date } | null {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) range.$gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) {
        // Inclusive of the whole "to" day.
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    return range.$gte || range.$lte ? range : null;
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

// ── Statistics helpers ──────────────────────────────────────────
//
// Kept as pure module functions (not methods) so they are trivially unit
// testable and free of any Mongo/Nest dependencies.

/** numerator/denominator as a percentage rounded to 2 dp; 0 when denom is 0. */
export function roundPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

/**
 * Two-proportion z-test, returning a two-tailed p-value for the difference
 * between a variant's and the control's conversion proportion.
 *
 * Returns null when there isn't enough data for the normal approximation to be
 * meaningful (any group empty, or the pooled proportion degenerate at 0 or 1) —
 * the caller then reports "not enough data" rather than a misleading p-value.
 */
export function twoProportionPValue(
  convA: number,
  nA: number,
  convB: number,
  nB: number,
): number | null {
  if (nA <= 0 || nB <= 0) return null;

  const pA = convA / nA;
  const pB = convB / nB;
  const pPooled = (convA + convB) / (nA + nB);
  if (pPooled <= 0 || pPooled >= 1) return null;

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB));
  if (se === 0) return null;

  const z = (pA - pB) / se;
  // Two-tailed: P(|Z| > |z|) = 2 * (1 - Φ(|z|)).
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  // Clamp to [0,1] against tiny floating-point overshoot.
  return Math.min(1, Math.max(0, p));
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 error-function
 * approximation (max abs error ~1.5e-7) — accurate enough for A/B confidence
 * reporting without pulling in a stats dependency.
 */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const prob =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - prob : prob;
}
