import {
  PROMOTED_SLOT_DENSITY,
  partitionByPromotion,
  promotedSlotPlan,
  promotedSlotsForPage,
} from './promoted-slots';

/**
 * Walks every page of a result set and reports what each one was made of.
 *
 * The properties that matter are about the whole sequence rather than any single
 * page — nothing repeated, nothing skipped — so the assertions need the pages
 * collected together.
 */
function paginate(params: {
  total: number;
  featuredTotal: number;
  limit: number;
  slotsPerPage?: number;
}) {
  const { total, limit } = params;
  const totalPages = Math.ceil(total / limit);
  const featuredSeen: number[] = [];
  const organicSeen: number[] = [];
  const pages: { featured: number; organic: number; size: number }[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const plan = promotedSlotPlan({ page, ...params });

    for (let i = 0; i < plan.featuredTake; i++) {
      featuredSeen.push(plan.featuredSkip + i);
    }
    for (let i = 0; i < plan.organicTake; i++) {
      organicSeen.push(plan.organicSkip + i);
    }
    pages.push({
      featured: plan.featuredTake,
      organic: plan.organicTake,
      size: plan.featuredTake + plan.organicTake,
    });
  }

  return { pages, featuredSeen, organicSeen, totalPages };
}

describe('promoted slots', () => {
  describe('promotedSlotsForPage', () => {
    it.each([
      [20, 3],
      [12, 2],
      [10, 2],
      [50, 8],
      [100, 15],
    ])('gives a page of %i items %i promoted slots', (limit, expected) => {
      expect(promotedSlotsForPage(limit)).toBe(expected);
    });

    it('holds density roughly constant across page sizes', () => {
      // The point of a density rather than a fixed count: a flat three would be
      // 15% of a results page but a quarter of the 12-item "Near You" rail.
      for (const limit of [10, 12, 20, 50, 100]) {
        const density = promotedSlotsForPage(limit) / limit;
        expect(Math.abs(density - PROMOTED_SLOT_DENSITY)).toBeLessThan(0.06);
      }
    });

    it('promotes nothing on pages too small to spare a slot', () => {
      // One promoted slot on a single-item page would be the entire result.
      expect(promotedSlotsForPage(1)).toBe(0);
      expect(promotedSlotsForPage(3)).toBe(0);
      expect(promotedSlotsForPage(0)).toBe(0);
    });
  });

  describe('promotedSlotPlan', () => {
    it('caps featured at the slot count instead of letting them lead every page', () => {
      // The regression this exists for: with isFeatured as the primary sort key,
      // all 2,428 featured listings came before any organic one, so the first 122
      // pages were nothing but featured.
      const { pages } = paginate({
        total: 40035,
        featuredTotal: 2428,
        limit: 20,
      });

      for (const page of pages.slice(0, 100)) {
        expect(page.featured).toBe(3);
        expect(page.organic).toBe(17);
      }
    });

    it('shows every document exactly once across all pages', () => {
      const { featuredSeen, organicSeen } = paginate({
        total: 400,
        featuredTotal: 24,
        limit: 20,
      });

      expect(featuredSeen).toEqual([...Array(24).keys()]);
      expect(organicSeen).toEqual([...Array(376).keys()]);
      expect(new Set(featuredSeen).size).toBe(featuredSeen.length);
      expect(new Set(organicSeen).size).toBe(organicSeen.length);
    });

    it('fills pages with organic once featured runs out', () => {
      // 10 featured at 3 a page is exhausted partway through page 4, so that page
      // is the one that has to absorb the difference. Deriving offsets from
      // page * perPage would skip 2 organic listings from here on.
      const { pages } = paginate({ total: 200, featuredTotal: 10, limit: 20 });

      expect(pages[0]).toEqual({ featured: 3, organic: 17, size: 20 });
      expect(pages[2]).toEqual({ featured: 3, organic: 17, size: 20 });
      expect(pages[3]).toEqual({ featured: 1, organic: 19, size: 20 });
      expect(pages[4]).toEqual({ featured: 0, organic: 20, size: 20 });
    });

    it('fills pages with featured when organic runs out', () => {
      // A narrow filter can leave almost nothing organic to show. Holding the
      // slot count rigid here would return pages of 8 and lose 85 listings.
      const { pages, featuredSeen, organicSeen } = paginate({
        total: 105,
        featuredTotal: 100,
        limit: 20,
      });

      for (const page of pages.slice(0, -1)) {
        expect(page.size).toBe(20);
      }
      expect(pages.at(-1)!.size).toBe(5);
      expect(featuredSeen).toEqual([...Array(100).keys()]);
      expect(organicSeen).toEqual([...Array(5).keys()]);
    });

    it('keeps the last page short rather than overrunning the total', () => {
      const { pages, totalPages } = paginate({
        total: 45,
        featuredTotal: 6,
        limit: 20,
      });

      expect(totalPages).toBe(3);
      expect(pages[2].size).toBe(5);
      expect(pages.reduce((sum, p) => sum + p.size, 0)).toBe(45);
    });

    it('returns an empty plan for an empty result set', () => {
      expect(
        promotedSlotPlan({ page: 1, limit: 20, total: 0, featuredTotal: 0 }),
      ).toEqual({
        featuredSkip: 0,
        featuredTake: 0,
        organicSkip: 0,
        organicTake: 0,
      });
    });

    it('takes nothing for a page past the end of the results', () => {
      const plan = promotedSlotPlan({
        page: 99,
        limit: 20,
        total: 45,
        featuredTotal: 6,
      });
      expect(plan.featuredTake).toBe(0);
      expect(plan.organicTake).toBe(0);
    });

    it('serves an all-organic result set without reserving dead slots', () => {
      const { pages } = paginate({ total: 60, featuredTotal: 0, limit: 20 });
      for (const page of pages) {
        expect(page).toEqual({ featured: 0, organic: 20, size: 20 });
      }
    });

    it('never reserves more slots than the page holds', () => {
      const plan = promotedSlotPlan({
        page: 1,
        limit: 2,
        total: 100,
        featuredTotal: 50,
        slotsPerPage: 10,
      });
      expect(plan.featuredTake).toBeLessThanOrEqual(2);
      expect(plan.featuredTake + plan.organicTake).toBe(2);
    });
  });

  describe('partitionByPromotion', () => {
    const now = new Date('2026-09-05T12:00:00Z');

    it('requires an unexpired paid window for a promoted slot', () => {
      // Matches what getFeaturedAds already checks, so a stale isFeatured flag
      // cannot hold a slot on its own.
      const { featuredFilter } = partitionByPromotion(
        { status: 'active' },
        now,
      );

      expect(featuredFilter).toEqual({
        status: 'active',
        isFeatured: true,
        featuredUntil: { $gt: now },
      });
    });

    it('routes expired and unflagged listings to the organic bucket', () => {
      // The two predicates have to be exact complements. Anything the promoted
      // bucket rejects must land here or it disappears from the result set
      // entirely, leaving a hole in the pagination.
      const { organicFilter } = partitionByPromotion({ status: 'active' }, now);

      expect(organicFilter.$and).toEqual([
        {
          $or: [
            { isFeatured: { $ne: true } },
            { featuredUntil: { $lte: now } },
            // $lte alone does not match a document with no featuredUntil at all,
            // which is the common case for a listing that was never featured.
            { featuredUntil: { $exists: false } },
          ],
        },
      ]);
    });

    it("preserves the caller's own $or instead of assigning over it", () => {
      // Search builds an $or for brand-by-name. Merging the organic predicate in
      // as another $or would drop that filter and widen the results.
      const brandOr = [{ brandName: /honda/i }, { vehicleBrandName: /honda/i }];

      const { organicFilter } = partitionByPromotion(
        { status: 'active', $or: brandOr },
        now,
      );

      expect(organicFilter.$or).toEqual(brandOr);
      expect(organicFilter.$and).toHaveLength(1);
    });

    it("keeps the caller's existing $and clauses", () => {
      // Category attribute filters arrive as $and entries.
      const attributeClause = {
        $or: [{ 'categoryAttributes.make': /honda/i }],
      };

      const { organicFilter } = partitionByPromotion(
        { status: 'active', $and: [attributeClause] },
        now,
      );

      expect(organicFilter.$and).toHaveLength(2);
      expect(organicFilter.$and[0]).toEqual(attributeClause);
    });
  });
});
