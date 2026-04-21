import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { Category, CategoryAttribute } from '../models';

export interface CreateCategoryPayload {
  name: string;
  slug: string;
  icon: string;
  parentId?: string;
  level: 1 | 2 | 3;
  isActive: boolean;
  hasBrands?: boolean;
  sortOrder: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  icon?: string;
  isActive?: boolean;
  hasBrands?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  constructor(private readonly api: ApiService) {}

  getAll(): Observable<Category[]> {
    return this.api
      .get<Category[]>('/categories')
      .pipe(map((tree) => this.flattenTree(Array.isArray(tree) ? tree : [])));
  }

  getTree(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories');
  }

  getById(id: string): Observable<Category> {
    return this.api.get<Category>(`/categories/${id}`);
  }

  getBySlug(slug: string): Observable<Category | undefined> {
    return this.getAll().pipe(map((categories) => categories.find((c) => c.slug === slug)));
  }

  getChildren(parentId: string): Observable<Category[]> {
    return this.getAll().pipe(
      map((categories) => categories.filter((c) => c.parentId === parentId && c.isActive)),
    );
  }

  create(payload: CreateCategoryPayload): Observable<Category> {
    return this.api.post<Category>('/categories', payload);
  }

  update(id: string, payload: UpdateCategoryPayload): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/categories/${id}`);
  }

  getInheritedAttributes(
    categoryId: string,
  ): Observable<{ attributes: CategoryAttribute[]; features: string[] }> {
    return this.api.get<{ attributes: CategoryAttribute[]; features: string[] }>(
      `/categories/${categoryId}/inherited-attributes`,
    );
  }

  updateAttributes(id: string, attributes: CategoryAttribute[]): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}/attributes`, { attributes });
  }

  updateFeatures(id: string, features: string[]): Observable<Category> {
    return this.api.patch<Category>(`/categories/${id}/features`, { features });
  }

  buildBreadcrumb(categories: Category[], targetId: string): Category[] {
    const trail: Category[] = [];
    let current = categories.find((c) => c._id === targetId);
    while (current) {
      trail.unshift(current);
      current = current.parentId ? categories.find((c) => c._id === current!.parentId) : undefined;
    }
    return trail;
  }

  private flattenTree(tree: Category[]): Category[] {
    const result: Category[] = [];
    const walk = (nodes: Category[]) => {
      for (const node of nodes) {
        const { children, ...rest } = node as Category & { children?: Category[] };
        result.push(rest as Category);
        if (children?.length) {
          walk(children);
        }
      }
    };
    walk(tree);
    return result;
  }
}
