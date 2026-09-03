export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
}

export interface Experiment {
  _id: string;
  key: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ExperimentVariant[];
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface VariantMetrics {
  variantId: string;
  variantName: string;
  weight: number;
  subjects: number;
  impressions: number;
  clicks: number;
  ctr: number;
  favorites: number;
  contacts: number;
  conversions: number;
  avgClickPosition: number;
  /** Whether this variant is the baseline all others are compared against. */
  isControl: boolean;
  /** Converting subjects / exposed subjects, as a percentage. */
  conversionRate: number;
  /** Distinct subjects who converted at least once. */
  convertedSubjects: number;
  /** Relative change in conversion rate vs control (%). Null for control/no data. */
  upliftVsControl: number | null;
  /** Two-proportion z-test p-value vs control. Null for control/insufficient data. */
  pValue: number | null;
  /** Confidence the difference is real (100 - p*100), percent. Null if no data. */
  confidence: number | null;
  /** True when confidence ≥ 95%. */
  isSignificant: boolean;
}

export interface ExperimentMetrics {
  experimentKey: string;
  experimentName: string;
  status: string;
  variants: VariantMetrics[];
  startedAt?: string;
  totalSubjects: number;
  /** Variant used as the control/baseline. */
  controlVariantId: string | null;
  /** Recommended winner (significant + highest conversion). Null if none yet. */
  winnerVariantId: string | null;
  dateFrom?: string;
  dateTo?: string;
}

export type StatusFilter = '' | 'draft' | 'running' | 'paused' | 'completed';
export type SortField = 'createdAt' | 'name' | 'status';
