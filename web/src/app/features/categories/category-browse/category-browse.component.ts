import { Component, OnInit, signal, computed } from '@angular/core';
import { CategoriesService } from '../../../core/services/categories.service';
import { CategoryModalComponent } from '../../../shared/components/category-modal/category-modal.component';
import { CategoryCardComponent } from '../../../shared/components/category-card/category-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Category } from '../../../core/models';
import { CATEGORY_ICONS_PATH, DEFAULT_CATEGORY_ICON } from '../../../core/constants/app';

@Component({
  selector: 'app-category-browse',
  standalone: true,
  imports: [CategoryModalComponent, CategoryCardComponent, EmptyStateComponent],
  templateUrl: './category-browse.component.html',
  styleUrls: ['./category-browse.component.scss'],
})
export class CategoryBrowseComponent implements OnInit {
  readonly SKELETON_ITEMS = Array.from({ length: 12 }, (_, i) => i);
  readonly allCategories = signal<Category[]>([]);
  readonly loading = signal(true);

  readonly topLevelCategories = computed(() =>
    this.allCategories()
      .filter((c) => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  readonly selectedCategory = signal<Category | null>(null);

  constructor(private readonly categoriesService: CategoriesService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  getCategoryImage(category: Category): string {
    if (category.icon) return `${CATEGORY_ICONS_PATH}/${category.icon}`;
    return DEFAULT_CATEGORY_ICON;
  }

  getSubcategoryCount(categoryId: string): number {
    return this.allCategories().filter((c) => c.parentId === categoryId && c.isActive).length;
  }

  /** Empty string when there are none, so the card omits the line entirely. */
  subcategoryLabel(categoryId: string): string {
    const count = this.getSubcategoryCount(categoryId);
    if (count === 0) return '';
    return `${count} subcategor${count === 1 ? 'y' : 'ies'}`;
  }

  openCategoryModal(category: Category): void {
    this.selectedCategory.set(category);
  }

  closeCategoryModal(): void {
    this.selectedCategory.set(null);
  }

  private loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (categories) => {
        this.allCategories.set(categories);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
