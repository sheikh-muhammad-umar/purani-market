export interface SearchResultItem {
  _id: string;
  _score?: number;
  _relaxed?: boolean;
  title: string;
  description?: string;
  price?: { amount: number; currency: string };
  location?: Record<string, unknown>;
  [key: string]: unknown;
}

/** One option of a facet, with how many results it would yield. */
export interface FacetBucket {
  value: string;
  count: number;
}

/**
 * Per-option counts (or numeric bounds) for a filterable category attribute,
 * so the filter panel can show "Petrol (22)" and hide options that match nothing.
 */
export interface SearchFacet {
  key: string;
  type: string;
  /** Present for option-style attributes (select, multiselect, boolean). */
  buckets?: FacetBucket[];
  /** Present for numeric attributes (number, year, range). */
  min?: number | null;
  max?: number | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions?: string[];
  relatedCategories?: string[];
  facets?: SearchFacet[];
}

export interface SuggestionResult {
  suggestions: string[];
}

/** Ranking weights that can be tuned via A/B experiments */
export interface RankingConfig {
  phraseBoost: number;
  recencyScale: string;
  recencyWeight: number;
  popularityViewWeight: number;
  popularityFavWeight: number;
  synonymBoost: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  phraseBoost: 25,
  recencyScale: '15d',
  recencyWeight: 1.5,
  popularityViewWeight: 0.5,
  popularityFavWeight: 0.8,
  synonymBoost: 2,
};
