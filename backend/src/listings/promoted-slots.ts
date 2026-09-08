/**
 * Bounded promotion for listing result sets.
 *
 * Featured listings used to be promoted by making `isFeatured` the primary sort
 * key of every MongoDB-backed listing query. That is not a boost, it is a gate:
 * with 2,428 active featured listings out of 40,035, the first 122 pages of
 * *every* browse, nearby and fallback-search result set were featured, and no
 * buyer would ever reach an organic one.
 *
 * It also made the sort control lie. `sort=newest` returned the newest featured
 * listing and `price_asc` returned the cheapest featured listing, so a buyer
 * filtering by price got an answer that was wrong by orders of magnitude.
 *
 * Instead, a fixed number of slots per page is reserved for featured listings and
 * the rest of the page is ordered purely by what the caller asked for. Featured
 * listings are excluded from that remainder, so nothing appears twice.
 *
 * The Elasticsearch path had the same problem in a different form. Featured was a
 * `weight: 5` function inside `function_score`, described as one signal among
 * recency and popularity — but the search page's default sort is relevance with no
 * text query, so every document scored 1.0 and the flat +5 exceeded everything the
 * other signals could reach combined. It gated just as completely: pages 1 to 120
 * came back 20/20 featured. That function is gone and search reserves slots the
 * same way, so promotion is structural everywhere and counted once.
 */

/**
 * Share of a page reserved for featured listings.
 *
 * Three of a standard twenty-item page: enough that a promoted slot is worth
 * paying for, low enough that the organic results remain the substance of the
 * page. Expressed as a density rather than a fixed count because the same code
 * serves a 20-item results page and the 12-item "Near You" rail, and a flat three
 * would quietly turn into a quarter of the smaller one.
 */
export const PROMOTED_SLOT_DENSITY = 0.15;

/**
 * Promoted slots a page of `limit` items gets.
 *
 * Rounds to nothing for very small pages, which is deliberate: on a four-item
 * rail one promoted slot is already a quarter of it, and on a single-item page
 * promotion would be the entire result.
 */
export function promotedSlotsForPage(limit: number): number {
  return Math.max(
    0,
    Math.min(limit, Math.round(limit * PROMOTED_SLOT_DENSITY)),
  );
}

export interface PromotedSlotPlan {
  featuredSkip: number;
  featuredTake: number;
  organicSkip: number;
  organicTake: number;
}

/**
 * Which slice of each bucket page `page` is made of.
 *
 * Derived from a cumulative count rather than a per-page multiplication because
 * the two buckets are consumed at different rates and either can run dry. Once
 * one is exhausted the other has to absorb the difference, and from that point on
 * `(page - 1) * perPage` no longer describes where the next page starts — it
 * would skip past documents that were never shown.
 *
 * Expressed as cumulative-through-this-page minus cumulative-through-the-previous
 * so consecutive pages are contiguous by construction: every matching document
 * appears on exactly one page, whichever bucket empties first.
 */
export function promotedSlotPlan(params: {
  page: number;
  limit: number;
  /** Every document matching the filter, featured and organic together. */
  total: number;
  /** Documents matching the filter that qualify for a promoted slot. */
  featuredTotal: number;
  slotsPerPage?: number;
}): PromotedSlotPlan {
  const { page, limit, total, featuredTotal } = params;
  // A page cannot hold more promoted slots than it has room for, which matters
  // for the small rails (the "Near You" strip asks for 12) and for limit=1.
  const slots = Math.max(
    0,
    Math.min(params.slotsPerPage ?? promotedSlotsForPage(limit), limit),
  );
  const organicTotal = Math.max(0, total - featuredTotal);

  /**
   * How many of each bucket have been shown by the end of page `p`.
   *
   * Organic is the one that gets clamped: featured claims its slots first, the
   * rest of the page is organic, and if organic runs out early the leftover room
   * falls back to featured so the page still comes back full.
   */
  const cumulative = (p: number): { featured: number; organic: number } => {
    const shown = Math.min(Math.max(0, p) * limit, total);
    const promoted = Math.min(featuredTotal, Math.max(0, p) * slots);
    const organic = Math.min(organicTotal, Math.max(0, shown - promoted));
    return { featured: shown - organic, organic };
  };

  const previous = cumulative(page - 1);
  const current = cumulative(page);

  return {
    featuredSkip: previous.featured,
    featuredTake: Math.max(0, current.featured - previous.featured),
    organicSkip: previous.organic,
    organicTake: Math.max(0, current.organic - previous.organic),
  };
}

/**
 * Splits a listing filter into the promoted half and its exact complement.
 *
 * `featuredUntil` is checked here and not just `isFeatured`, matching what
 * `getFeaturedAds` already does, so a listing whose paid window has lapsed cannot
 * hold a promoted slot on the strength of a stale flag alone.
 *
 * The two predicates are exact complements — `NOT (featured AND unexpired)`
 * expanded into its three cases — which is what keeps pagination whole. Anything
 * the promoted bucket rejects has to land in the organic bucket instead, or it
 * would drop out of the result set altogether. `featuredUntil: { $lte: now }`
 * would not match a document where the field is absent, hence the explicit
 * `$exists` branch.
 *
 * Combined under `$and` rather than merged in, because callers already build
 * their own `$or` (brand-by-name) and `$and` (category attributes) clauses and
 * assigning over either would quietly drop the caller's filter.
 */
export function partitionByPromotion(
  filter: Record<string, any>,
  now: Date = new Date(),
): { featuredFilter: Record<string, any>; organicFilter: Record<string, any> } {
  const promoted = { isFeatured: true, featuredUntil: { $gt: now } };

  return {
    featuredFilter: { ...filter, ...promoted },
    organicFilter: {
      ...filter,
      $and: [
        ...((filter.$and as Record<string, unknown>[] | undefined) ?? []),
        {
          $or: [
            { isFeatured: { $ne: true } },
            { featuredUntil: { $lte: now } },
            { featuredUntil: { $exists: false } },
          ],
        },
      ],
    },
  };
}

/**
 * Elasticsearch clauses for the promoted half and its complement.
 *
 * Partitioned on `isFeatured` alone, unlike the MongoDB side, because
 * `featuredUntil` is not in the listings index mapping and so cannot be filtered
 * on here. The two clauses are still exact complements, which is what pagination
 * depends on; the effect of the missing date check is only that a listing whose
 * paid window has lapsed but whose flag has not yet been cleared by the expiry
 * job can hold a promoted slot in search.
 */
export function esPromotionClauses(): {
  featuredClause: Record<string, unknown>;
  organicClause: Record<string, unknown>;
} {
  const promoted = { term: { isFeatured: true } };

  return {
    featuredClause: promoted,
    organicClause: { bool: { must_not: [promoted] } },
  };
}
