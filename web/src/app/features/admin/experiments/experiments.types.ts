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
}

export interface ExperimentMetrics {
  experimentKey: string;
  experimentName: string;
  status: string;
  variants: VariantMetrics[];
  startedAt?: string;
  totalSubjects: number;
}

export type StatusFilter = '' | 'draft' | 'running' | 'paused' | 'completed';
export type SortField = 'createdAt' | 'name' | 'status';
