export type CategoryAttributeType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
export type CategoryFilterType = 'range' | 'select' | 'multiselect' | 'boolean';

export interface CategoryAttribute {
  name: string;
  key: string;
  type: CategoryAttributeType;
  options?: string[];
  required: boolean;
  unit?: string;
}

export interface CategoryFilter {
  name: string;
  key: string;
  type: CategoryFilterType;
  options?: string[];
  rangeMin?: number;
  rangeMax?: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: 1 | 2 | 3;
  attributes: CategoryAttribute[];
  filters: CategoryFilter[];
  isActive: boolean;
  sortOrder: number;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}
