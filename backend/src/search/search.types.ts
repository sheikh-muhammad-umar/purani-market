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

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions?: string[];
  relatedCategories?: string[];
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
