import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ExperimentsService,
  roundPct,
  twoProportionPValue,
  normalCdf,
} from './experiments.service.js';
import { Experiment, ExperimentStatus } from './schemas/experiment.schema.js';
import {
  ExperimentEvent,
  ExperimentEventType,
} from './schemas/experiment-event.schema.js';

/** A running experiment with a 50/50 control/variant split. */
function runningExperiment(overrides: Partial<any> = {}) {
  return {
    _id: new Types.ObjectId(),
    key: 'search_test',
    name: 'Search Test',
    status: ExperimentStatus.RUNNING,
    variants: [
      { id: 'control', name: 'Control', weight: 50, config: { a: 1 } },
      { id: 'variant', name: 'Variant', weight: 50, config: { a: 2 } },
    ],
    startedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let experimentModel: any;
  let eventModel: any;

  beforeEach(async () => {
    experimentModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn(),
    };

    eventModel = {
      create: jest.fn().mockResolvedValue({}),
      aggregate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        { provide: getModelToken(Experiment.name), useValue: experimentModel },
        { provide: getModelToken(ExperimentEvent.name), useValue: eventModel },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
  });

  // ── Assignment / bucketing ──────────────────────────────────────

  describe('getAssignments', () => {
    function mockRunning(exps: any[]) {
      experimentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(exps),
      });
    }

    it('assigns a variant for each running experiment', async () => {
      mockRunning([runningExperiment()]);
      const assignments = await service.getAssignments('user-1');
      expect(assignments).toHaveLength(1);
      expect(assignments[0].experimentKey).toBe('search_test');
      expect(['control', 'variant']).toContain(assignments[0].variantId);
      // config of the chosen variant is returned
      expect(assignments[0].config).toEqual(
        expect.objectContaining({ a: expect.any(Number) }),
      );
    });

    it('is deterministic — same subject always gets the same variant', async () => {
      mockRunning([runningExperiment()]);
      const first = await service.getAssignments('stable-subject');
      // Force a cache refresh path by resetting via a running fetch again
      const second = await service.getAssignments('stable-subject');
      expect(second[0].variantId).toBe(first[0].variantId);
    });

    it('gives different subjects a spread across variants (weighted)', async () => {
      mockRunning([runningExperiment()]);
      const counts: Record<string, number> = { control: 0, variant: 0 };
      for (let i = 0; i < 500; i++) {
        const a = await service.getAssignments(`subject-${i}`);
        counts[a[0].variantId]++;
      }
      // Both buckets should get a meaningful share of a 50/50 split.
      expect(counts.control).toBeGreaterThan(150);
      expect(counts.variant).toBeGreaterThan(150);
    });

    it('caches running experiments for the TTL window (one DB read)', async () => {
      mockRunning([runningExperiment()]);
      await service.getAssignments('a');
      await service.getAssignments('b');
      expect(experimentModel.find).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no experiments are running', async () => {
      mockRunning([]);
      expect(await service.getAssignments('user-1')).toEqual([]);
    });
  });

  describe('getAssignment (single)', () => {
    it('returns null when the experiment is not running', async () => {
      experimentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([runningExperiment()]),
      });
      expect(await service.getAssignment('u', 'nope')).toBeNull();
    });

    it('returns the assignment for a running experiment', async () => {
      experimentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([runningExperiment()]),
      });
      const a = await service.getAssignment('u', 'search_test');
      expect(a?.experimentKey).toBe('search_test');
    });
  });

  // ── Event tracking ──────────────────────────────────────────────

  describe('trackEvent', () => {
    it('persists an event, converting a valid listingId to ObjectId', async () => {
      const listingId = new Types.ObjectId().toString();
      await service.trackEvent(
        'search_test',
        'control',
        ExperimentEventType.SEARCH_CLICK,
        'user-1',
        { listingId, position: 2, searchQuery: 'car' },
      );
      const doc = eventModel.create.mock.calls[0][0];
      expect(doc.experimentKey).toBe('search_test');
      expect(doc.listingId).toBeInstanceOf(Types.ObjectId);
      expect(doc.position).toBe(2);
    });

    it('does not throw and stores undefined for a malformed listingId', async () => {
      await expect(
        service.trackEvent(
          'search_test',
          'control',
          ExperimentEventType.SEARCH_CLICK,
          'user-1',
          { listingId: 'not-an-object-id' },
        ),
      ).resolves.toBeUndefined();
      expect(eventModel.create.mock.calls[0][0].listingId).toBeUndefined();
    });

    it('stores undefined listingId when omitted', async () => {
      await service.trackEvent(
        'search_test',
        'control',
        ExperimentEventType.SEARCH_IMPRESSION,
        'user-1',
      );
      expect(eventModel.create.mock.calls[0][0].listingId).toBeUndefined();
    });
  });

  // ── Metrics & analysis ──────────────────────────────────────────

  describe('getMetrics', () => {
    it('throws NotFound when the experiment does not exist', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getMetrics('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('maps aggregation rows to per-variant funnel metrics and CTR', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      eventModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { variantId: 'control', eventType: 'search_impression' },
            count: 100,
            uniqueSubjects: ['s1', 's2', 's3'],
            avgPosition: null,
          },
          {
            _id: { variantId: 'control', eventType: 'search_click' },
            count: 10,
            uniqueSubjects: ['s1', 's2'],
            avgPosition: 3.5,
          },
        ]),
      });

      const m = await service.getMetrics('search_test');
      const control = m.variants.find((v) => v.variantId === 'control')!;
      expect(control.impressions).toBe(100);
      expect(control.clicks).toBe(10);
      expect(control.ctr).toBe(10); // 10/100 = 10%
      expect(control.avgClickPosition).toBe(3.5);
      expect(control.subjects).toBe(3); // union of subject sets
      expect(control.isControl).toBe(true);
    });

    it('computes conversion rate from distinct converting subjects', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      eventModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { variantId: 'control', eventType: 'search_impression' },
            count: 4,
            uniqueSubjects: ['a', 'b', 'c', 'd'],
          },
          {
            _id: { variantId: 'control', eventType: 'conversion' },
            count: 3, // 3 events but from 1 subject
            uniqueSubjects: ['a'],
          },
        ]),
      });

      const m = await service.getMetrics('search_test');
      const control = m.variants.find((v) => v.variantId === 'control')!;
      expect(control.subjects).toBe(4);
      expect(control.convertedSubjects).toBe(1);
      expect(control.conversionRate).toBe(25); // 1/4
      expect(control.conversions).toBe(3);
    });

    it('flags a variant as significant when it clearly beats control', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      // Control: 50/1000 = 5%. Variant: 150/1000 = 15%. Large, obviously significant.
      const subjects = (n: number) =>
        Array.from({ length: n }, (_, i) => `s${i}`);
      eventModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { variantId: 'control', eventType: 'search_impression' },
            count: 1000,
            uniqueSubjects: subjects(1000),
          },
          {
            _id: { variantId: 'control', eventType: 'conversion' },
            count: 50,
            uniqueSubjects: subjects(50),
          },
          {
            _id: { variantId: 'variant', eventType: 'search_impression' },
            count: 1000,
            uniqueSubjects: subjects(1000).map((s) => `v${s}`),
          },
          {
            _id: { variantId: 'variant', eventType: 'conversion' },
            count: 150,
            uniqueSubjects: subjects(150).map((s) => `v${s}`),
          },
        ]),
      });

      const m = await service.getMetrics('search_test');
      const variant = m.variants.find((v) => v.variantId === 'variant')!;
      expect(variant.conversionRate).toBe(15);
      expect(variant.upliftVsControl).toBe(200); // (15-5)/5 = +200%
      expect(variant.isSignificant).toBe(true);
      expect(variant.confidence).not.toBeNull();
      expect(variant.confidence!).toBeGreaterThanOrEqual(95);
      expect(m.winnerVariantId).toBe('variant');
      expect(m.controlVariantId).toBe('control');
    });

    it('does not declare a winner when results are not significant', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      // Tiny samples, near-identical rates — not significant.
      eventModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: { variantId: 'control', eventType: 'search_impression' },
            count: 10,
            uniqueSubjects: ['a', 'b', 'c', 'd', 'e'],
          },
          {
            _id: { variantId: 'control', eventType: 'conversion' },
            count: 1,
            uniqueSubjects: ['a'],
          },
          {
            _id: { variantId: 'variant', eventType: 'search_impression' },
            count: 10,
            uniqueSubjects: ['v', 'w', 'x', 'y', 'z'],
          },
          {
            _id: { variantId: 'variant', eventType: 'conversion' },
            count: 1,
            uniqueSubjects: ['v'],
          },
        ]),
      });

      const m = await service.getMetrics('search_test');
      expect(m.winnerVariantId).toBeNull();
      const variant = m.variants.find((v) => v.variantId === 'variant')!;
      expect(variant.isSignificant).toBe(false);
    });

    it('passes a date range into the aggregation match when provided', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      const execMock = jest.fn().mockResolvedValue([]);
      eventModel.aggregate.mockReturnValue({ exec: execMock });

      await service.getMetrics('search_test', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      const pipeline = eventModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.experimentKey).toBe('search_test');
      expect(match.createdAt.$gte).toBeInstanceOf(Date);
      expect(match.createdAt.$lte).toBeInstanceOf(Date);
    });

    it('honours an explicit controlVariantId', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      const m = await service.getMetrics('search_test', {
        controlVariantId: 'variant',
      });
      expect(m.controlVariantId).toBe('variant');
      expect(m.variants.find((v) => v.variantId === 'variant')!.isControl).toBe(
        true,
      );
    });

    it('returns zeroed metrics (no crash) when there are no events', async () => {
      experimentModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      const m = await service.getMetrics('search_test');
      expect(m.totalSubjects).toBe(0);
      for (const v of m.variants) {
        expect(v.ctr).toBe(0);
        expect(v.conversionRate).toBe(0);
      }
      expect(m.winnerVariantId).toBeNull();
    });
  });

  // ── CRUD & cache invalidation ───────────────────────────────────

  describe('lifecycle transitions', () => {
    it('create() inserts as DRAFT and defaults variant config', async () => {
      experimentModel.create.mockResolvedValue({ key: 'k' });
      await service.create({
        key: 'k',
        name: 'K',
        variants: [{ id: 'c', name: 'C', weight: 100 }],
      });
      const arg = experimentModel.create.mock.calls[0][0];
      expect(arg.status).toBe(ExperimentStatus.DRAFT);
      expect(arg.variants[0].config).toEqual({});
    });

    it('start() sets RUNNING + startedAt and invalidates the cache', async () => {
      // Prime the cache.
      experimentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      await service.getAssignments('u');
      expect(experimentModel.find).toHaveBeenCalledTimes(1);

      experimentModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(runningExperiment({ key: 'k' })),
      });
      await service.start('k');
      const update = experimentModel.findOneAndUpdate.mock.calls[0][1];
      expect(update.status).toBe(ExperimentStatus.RUNNING);
      expect(update.startedAt).toBeInstanceOf(Date);

      // Next getAssignments must re-read (cache invalidated).
      await service.getAssignments('u');
      expect(experimentModel.find).toHaveBeenCalledTimes(2);
    });

    it('complete() sets COMPLETED + endedAt', async () => {
      experimentModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(runningExperiment()),
      });
      await service.complete('search_test');
      const update = experimentModel.findOneAndUpdate.mock.calls[0][1];
      expect(update.status).toBe(ExperimentStatus.COMPLETED);
      expect(update.endedAt).toBeInstanceOf(Date);
    });

    it('start/pause/complete throw NotFound for unknown keys', async () => {
      experimentModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.start('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.pause('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.complete('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

// ── Pure statistics helpers ────────────────────────────────────────

describe('statistics helpers', () => {
  describe('roundPct', () => {
    it('returns 0 when the denominator is 0', () => {
      expect(roundPct(5, 0)).toBe(0);
    });
    it('rounds to two decimals', () => {
      expect(roundPct(1, 3)).toBe(33.33);
      expect(roundPct(10, 100)).toBe(10);
    });
  });

  describe('normalCdf', () => {
    it('is 0.5 at the mean', () => {
      expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    });
    it('matches known quantiles', () => {
      expect(normalCdf(1.645)).toBeCloseTo(0.95, 2);
      expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
      expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
    });
  });

  describe('twoProportionPValue', () => {
    it('returns null when a group is empty', () => {
      expect(twoProportionPValue(0, 0, 5, 100)).toBeNull();
    });
    it('returns null when nobody converts (degenerate pooled proportion)', () => {
      expect(twoProportionPValue(0, 100, 0, 100)).toBeNull();
    });
    it('is large (not significant) for near-identical proportions', () => {
      const p = twoProportionPValue(50, 1000, 51, 1000);
      expect(p).not.toBeNull();
      expect(p!).toBeGreaterThan(0.05);
    });
    it('is small (significant) for a big, well-powered difference', () => {
      const p = twoProportionPValue(150, 1000, 50, 1000);
      expect(p).not.toBeNull();
      expect(p!).toBeLessThan(0.05);
    });
    it('is symmetric in its two groups', () => {
      const p1 = twoProportionPValue(150, 1000, 50, 1000);
      const p2 = twoProportionPValue(50, 1000, 150, 1000);
      expect(p1!).toBeCloseTo(p2!, 10);
    });
  });
});
