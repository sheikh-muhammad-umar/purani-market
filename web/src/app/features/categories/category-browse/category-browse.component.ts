import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriesService } from '../../../core/services/categories.service';
import { CategoryModalComponent } from '../../../shared/components/category-modal/category-modal.component';
import { Category } from '../../../core/models';

const DEFAULT_ICON = 'assets/category-icons/default.jpg';

@Component({
  selector: 'app-category-browse',
  standalone: true,
  imports: [CommonModule, CategoryModalComponent],
  templateUrl: './category-browse.component.html',
  styleUrls: ['./category-browse.component.scss'],
})
export class CategoryBrowseComponent implements OnInit {
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
    if (category.icon) return `assets/category-icons/${category.icon}`;
    return DEFAULT_ICON;
  }

  getSubcategoryCount(categoryId: string): number {
    return this.allCategories().filter((c) => c.parentId === categoryId && c.isActive).length;
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
