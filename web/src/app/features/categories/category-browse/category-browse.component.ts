import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriesService } from '../../../core/services/categories.service';
import { CategoryModalComponent } from '../../../shared/components/category-modal/category-modal.component';
import { Category } from '../../../core/models';

const CATEGORY_IMAGES: Record<string, string> = {
  cars: 'assets/categories/cars.jpg',
  vehicles: 'assets/categories/vehicles.jpg',
  phones: 'assets/categories/phones.jpg',
  'mobile phones': 'assets/categories/phones.jpg',
  electronics: 'assets/categories/electronics.jpg',
  property: 'assets/categories/property.jpg',
  'real estate': 'assets/categories/property.jpg',
  fashion: 'assets/categories/fashion.jpg',
  clothing: 'assets/categories/fashion.jpg',
  furniture: 'assets/categories/furniture.jpg',
  'home & garden': 'assets/categories/home.jpg',
  jobs: 'assets/categories/jobs.jpg',
  services: 'assets/categories/services.jpg',
  kids: 'assets/categories/kids.jpg',
  sports: 'assets/categories/sports.jpg',
  animals: 'assets/categories/animals.jpg',
  pets: 'assets/categories/pets.jpg',
  books: 'assets/categories/books.jpg',
};

const CATEGORY_ICONS: Record<string, string> = {
  cars: '🚗',
  vehicles: '🚗',
  phones: '📱',
  'mobile phones': '📱',
  electronics: '📱',
  property: '🏠',
  'real estate': '🏠',
  fashion: '👗',
  clothing: '👗',
  furniture: '🪑',
  'home & garden': '🪑',
  jobs: '💼',
  services: '🔧',
  kids: '🧸',
  sports: '⚽',
  animals: '🐾',
  pets: '🐾',
  books: '📚',
};

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

  getCategoryImage(slug: string, name: string): string {
    const key = slug.toLowerCase();
    if (CATEGORY_IMAGES[key]) return CATEGORY_IMAGES[key];
    const nameKey = name.toLowerCase();
    if (CATEGORY_IMAGES[nameKey]) return CATEGORY_IMAGES[nameKey];
    return 'assets/categories/default.jpg';
  }

  getCategoryIcon(slug: string, name: string): string {
    const key = slug.toLowerCase();
    if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
    const nameKey = name.toLowerCase();
    if (CATEGORY_ICONS[nameKey]) return CATEGORY_ICONS[nameKey];
    return '📦';
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
