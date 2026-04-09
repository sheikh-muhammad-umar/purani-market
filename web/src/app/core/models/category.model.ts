export type CategoryAttributeType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'range' | 'year';

export interface CategoryAttribute {
  name: string;
  key: string;
  type: CategoryAttributeType;
  options?: string[];
  required: boolean;
  unit?: string;
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
  features: string[];
  isActive: boolean;
  sortOrder: number;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}
