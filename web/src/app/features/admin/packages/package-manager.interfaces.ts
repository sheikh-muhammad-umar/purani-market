export type FormPanel = 'none' | 'create' | 'edit';

export interface CategoryPricingGroup {
  categoryIds: string[];
  price: number;
}

export interface PricingDisplayGroup {
  price: number;
  categories: string[];
}
