import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, takeUntil, forkJoin, of } from 'rxjs';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../../core/services/listings.service';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { SortDropdownComponent, SortOption } from '../../../shared/components/sort-dropdown/sort-dropdown.component';
import { Category, Listing } from '../../../core/models';

export interface BreadcrumbItem {
  label: string;
  slug: string;
  isActive: boolean;
}

@Component({
  selector: 'app-category-listings',
  standalone: true,
  imports: [CommonModule, RouterLink, PriceFormatPipe, TruncateTextPipe, SortDropdownComponent, ListingUrlPipe],
  templateUrl: './category-listings.component.html',
  styleUrls: ['./category-listings.component.scss'],
})
export class CategoryListingsComponent implements OnInit, OnDestroy {
  readonly allCategories = signal<Category[]>([]);
  readonly currentCategory = signal<Category | null>(null);
  readonly subcategories = signal<Category[]>([]);
  readonly listings = signal<Listing[]>([]);
  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  readonly loadingCategory = signal(true);
  readonly loadingListings = signal(true);

  readonly totalListings = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly currentSort = signal<SortOption | null>(null);

  readonly hasListings = computed(() => this.listings().length > 0);
  readonly hasSubcategories = computed(() => this.subcategories().length > 0);

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const slug = params.get('slug');
        if (slug) {
          this.loadCategoryData(slug);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getListingImage(listing: Listing): string {
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png';
  }

  loadPage(page: number): void {
    const cat = this.currentCategory();
    if (!cat) return;
    this.currentPage.set(page);
    const sort = this.currentSort();
    this.loadListings(cat._id, page, sort?.sort, sort?.order);
  }

  onSortChange(option: SortOption): void {
    this.currentSort.set(option);
    this.currentPage.set(1);
    const cat = this.currentCategory();
    if (cat) {
      this.loadListings(cat._id, 1, option.sort, option.order);
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalListings() / this.pageSize);
  }

  private loadCategoryData(slug: string): void {
    this.loadingCategory.set(true);
    this.loadingListings.set(true);
    this.currentPage.set(1);

    this.categoriesService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.allCategories.set(categories);
          const category = this.findBySlug(categories, slug);

          if (!category) {
            this.loadingCategory.set(false);
            this.loadingListings.set(false);
            return;
          }

          this.currentCategory.set(category);
          this.breadcrumbs.set(this.buildBreadcrumbs(categories, category));
          this.subcategories.set(
            categories
              .filter(c => c.parentId === category._id && c.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder)
          );
          this.loadingCategory.set(false);
          const sort = this.currentSort();
          this.loadListings(category._id, 1, sort?.sort, sort?.order);
        },
        error: () => {
          this.loadingCategory.set(false);
          this.loadingListings.set(false);
        },
      });
  }

  private loadListings(categoryId: string, page: number, sort?: string, order?: 'asc' | 'desc'): void {
    this.loadingListings.set(true);
    this.listingsService.getByCategory(categoryId, page, this.pageSize, sort, order)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: ListingsResponse) => {
          this.listings.set(res.data);
          this.totalListings.set(res.total);
          this.loadingListings.set(false);
        },
        error: () => {
          this.listings.set([]);
          this.loadingListings.set(false);
        },
      });
  }

  private findBySlug(categories: Category[], slug: string): Category | undefined {
    for (const cat of categories) {
      if (cat.slug === slug) return cat;
      if (cat.children) {
        const found = this.findBySlug(cat.children, slug);
        if (found) return found;
      }
    }
    return undefined;
  }

  private buildBreadcrumbs(categories: Category[], target: Category): BreadcrumbItem[] {
    const trail = this.categoriesService.buildBreadcrumb(categories, target._id);
    return [
      { label: 'All Categories', slug: '', isActive: false },
      ...trail.map((cat, index) => ({
        label: cat.name,
        slug: cat.slug,
        isActive: index === trail.length - 1,
      })),
    ];
  }
}
