import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { SearchService, SearchParams, SearchResponse, SearchSuggestion } from '../../../core/services/search.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { SORT_OPTIONS } from '../../../core/constants/select-options';
import { SearchSortOption } from '../../../core/constants/enums';
import { PriceFormatPipe } from '../../../shared/pipes/price-format.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { Listing, Category, CategoryAttribute } from '../../../core/models';

export type SortOption = SearchSortOption;

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PriceFormatPipe, TruncateTextPipe, ListingUrlPipe],
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.scss'],
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  readonly query = signal('');
  readonly results = signal<Listing[]>([]);
  readonly featuredAds = signal<Listing[]>([]);
  readonly totalResults = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly sortBy = signal<SortOption>(SearchSortOption.RELEVANCE);
  readonly filtersOpen = signal(true);

  // Category filters
  readonly categories = signal<Category[]>([]);
  readonly selectedCategoryId = signal<string>('');
  readonly selectedCategory = signal<Category | null>(null);
  readonly categoryFilters = signal<CategoryAttribute[]>([]);

  // Dynamic filter values
  readonly filterValues = signal<Record<string, string | number | boolean>>({});
  readonly activeFilters = signal<ActiveFilter[]>([]);

  // Standard filters
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly selectedCondition = signal<string>('');

  // Suggestions
  readonly suggestions = signal<SearchSuggestion[]>([]);
  readonly showSuggestions = signal(false);
  readonly searchInput = signal('');

  // No results state
  readonly relatedCategories = signal<{ _id: string; name: string; slug: string }[]>([]);
  readonly suggestedTerms = signal<string[]>([]);

  readonly hasResults = computed(() => this.results().length > 0 || this.featuredAds().length > 0);
  readonly totalPages = computed(() => Math.ceil(this.totalResults() / this.pageSize));

  // Location filter
  readonly locationOpen = signal(false);
  readonly selectedCity = signal('');
  readonly expandedCategories = signal<Set<string>>(new Set());
  readonly popularCities = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'];
  readonly yearRange: number[] = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i);

  getYearRange(filter: { rangeMin?: number; rangeMax?: number }): number[] {
    const max = filter.rangeMax ?? new Date().getFullYear();
    const min = filter.rangeMin ?? 1970;
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }

  readonly sortOptions = SORT_OPTIONS;

  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: SearchService,
    private readonly categoriesService: CategoriesService,
    private readonly recentSearches: RecentSearchesService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.setupSuggestions();

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const q = params.get('q') || '';
        const category = params.get('category') || '';
        const sort = (params.get('sort') as SortOption) || SearchSortOption.RELEVANCE;
        const page = Number(params.get('page')) || 1;
        const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
        const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
        const condition = params.get('condition') || '';

        this.query.set(q);
        this.searchInput.set(q);
        this.selectedCategoryId.set(category);
        if (category) this.autoExpandCategory(category);
        this.sortBy.set(sort);
        this.currentPage.set(page);
        this.minPrice.set(minPrice);
        this.maxPrice.set(maxPrice);
        this.selectedCondition.set(condition);

        // Parse dynamic filter params
        const dynamicFilters: Record<string, string | number | boolean> = {};
        params.keys.forEach(key => {
          if (!['q', 'category', 'sort', 'page', 'minPrice', 'maxPrice', 'condition'].includes(key)) {
            dynamicFilters[key] = params.get(key) || '';
          }
        });
        this.filterValues.set(dynamicFilters);

        if (category) {
          this.loadCategoryFilters(category);
        }

        this.executeSearch();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInputChange(value: string): void {
    this.searchInput.set(value);
    this.searchInput$.next(value);
  }

  onSearchSubmit(): void {
    this.showSuggestions.set(false);
    this.currentPage.set(1);
    this.query.set(this.searchInput());
    this.recentSearches.add(this.searchInput());
    this.updateUrlAndSearch();
  }

  selectSuggestion(term: string): void {
    this.searchInput.set(term);
    this.showSuggestions.set(false);
    this.query.set(term);
    this.currentPage.set(1);
    this.recentSearches.add(term);
    this.updateUrlAndSearch();
  }

  hideSuggestions(): void {
    // Delay to allow click on suggestion
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  onSortChange(sort: SortOption): void {
    this.sortBy.set(sort);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.filterValues.set({});
    this.currentPage.set(1);
    if (categoryId) {
      this.loadCategoryFilters(categoryId);
    } else {
      this.categoryFilters.set([]);
      this.selectedCategory.set(null);
    }
    this.updateUrlAndSearch();
  }

  onConditionChange(condition: string): void {
    this.selectedCondition.set(condition);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onPriceFilterApply(): void {
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onDynamicFilterChange(key: string, value: string): void {
    const current = { ...this.filterValues() };
    if (value) {
      current[key] = value;
    } else {
      delete current[key];
    }
    this.filterValues.set(current);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'category') {
      this.onCategoryChange('');
    } else if (filter.key === 'condition') {
      this.onConditionChange('');
    } else if (filter.key === 'minPrice' || filter.key === 'maxPrice') {
      if (filter.key === 'minPrice') this.minPrice.set(null);
      if (filter.key === 'maxPrice') this.maxPrice.set(null);
      this.currentPage.set(1);
      this.updateUrlAndSearch();
    } else {
      this.onDynamicFilterChange(filter.key, '');
    }
  }

  clearAllFilters(): void {
    this.selectedCategoryId.set('');
    this.selectedCondition.set('');
    this.selectedCity.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.filterValues.set({});
    this.categoryFilters.set([]);
    this.selectedCategory.set(null);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  // Category tree helpers
  getSubcategories(parentId: string): Category[] {
    return this.categories().filter(c => c.parentId === parentId && c.isActive);
  }

  isCategoryChildSelected(parentId: string): boolean {
    const selected = this.selectedCategoryId();
    if (!selected) return false;
    const children = this.getSubcategories(parentId);
    for (const child of children) {
      if (child._id === selected) return true;
      if (this.isCategoryChildSelected(child._id)) return true;
    }
    return false;
  }

  toggleCategoryExpand(catId: string): void {
    this.expandedCategories.update(set => {
      const next = new Set(set);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }

  private autoExpandCategory(catId: string): void {
    // Find the category and expand all its ancestors
    const cats = this.categories();
    const toExpand = new Set<string>();
    let current = cats.find(c => c._id === catId);
    while (current?.parentId) {
      toExpand.add(current.parentId);
      current = cats.find(c => c._id === current!.parentId);
    }
    if (toExpand.size > 0) {
      this.expandedCategories.update(set => {
        const next = new Set(set);
        toExpand.forEach(id => next.add(id));
        return next;
      });
    }
  }

  // Location helpers
  selectCity(city: string): void {
    this.selectedCity.set(city);
    this.locationOpen.set(false);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  toggleFilters(): void {
    this.filtersOpen.set(!this.filtersOpen());
  }

  loadPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.updateUrlAndSearch();
  }

  getListingImage(listing: Listing): string {
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png';
  }

  buildActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const catId = this.selectedCategoryId();
    if (catId) {
      const cat = this.categories().find(c => c._id === catId);
      filters.push({ key: 'category', label: 'Category', value: catId, displayValue: cat?.name || catId });
    }
    const condition = this.selectedCondition();
    if (condition) {
      filters.push({ key: 'condition', label: 'Condition', value: condition, displayValue: condition.charAt(0).toUpperCase() + condition.slice(1) });
    }
    const min = this.minPrice();
    if (min !== null) {
      filters.push({ key: 'minPrice', label: 'Min Price', value: String(min), displayValue: `Min: PKR ${min}` });
    }
    const max = this.maxPrice();
    if (max !== null) {
      filters.push({ key: 'maxPrice', label: 'Max Price', value: String(max), displayValue: `Max: PKR ${max}` });
    }
    const dynamic = this.filterValues();
    Object.entries(dynamic).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        const filterDef = this.categoryFilters().find(f => f.key === key);
        filters.push({
          key,
          label: filterDef?.name || key,
          value: String(value),
          displayValue: `${filterDef?.name || key}: ${value}`,
        });
      }
    });
    return filters;
  }

  private setupSuggestions(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          if (!term || term.length < 2) {
            // Show recent searches when input is empty or short
            const recent = this.recentSearches.filter(term).map(t => ({ term: t, type: 'recent' as const }));
            return of(recent);
          }
          return this.searchService.getSuggestions(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(suggestions => {
        this.suggestions.set(suggestions);
        this.showSuggestions.set(suggestions.length > 0);
      });
  }

  private loadCategories(): void {
    this.categoriesService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: cats => this.categories.set(cats),
        error: () => this.categories.set([]),
      });
  }

  private loadCategoryFilters(categoryId: string): void {
    this.categoriesService.getById(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: cat => {
          this.selectedCategory.set(cat);
          this.categoryFilters.set(cat.attributes || []);
        },
        error: () => {
          this.categoryFilters.set([]);
          this.selectedCategory.set(null);
        },
      });
  }

  private buildSearchParams(): SearchParams {
    const params: SearchParams = {
      page: this.currentPage(),
      limit: this.pageSize,
    };
    const q = this.query();
    if (q) params.q = q;
    const sort = this.sortBy();
    if (sort !== SearchSortOption.RELEVANCE) params.sort = sort;
    const cat = this.selectedCategoryId();
    if (cat) params.category = cat;
    const min = this.minPrice();
    if (min !== null) params['priceMin'] = min;
    const max = this.maxPrice();
    if (max !== null) params['priceMax'] = max;
    const condition = this.selectedCondition();
    if (condition) params.condition = condition;

    // Dynamic category filters
    const dynamic = this.filterValues();
    Object.entries(dynamic).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params[key] = value;
      }
    });

    return params;
  }

  private executeSearch(): void {
    this.loading.set(true);
    this.activeFilters.set(this.buildActiveFilters());

    const params = this.buildSearchParams();

    if (params.q) {
      this.tracker.track('search', {
        searchQuery: params.q,
        categoryId: params.category as string | undefined,
        metadata: { sort: params.sort, page: params.page },
      });
    }

    this.searchService.search(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: SearchResponse) => {
          this.results.set(res.data || (res as any).items || []);
          this.featuredAds.set(res.featuredAds || []);
          this.totalResults.set(res.total);
          this.relatedCategories.set(res.relatedCategories || []);
          this.suggestedTerms.set(res.suggestions || []);
          this.loading.set(false);
        },
        error: () => {
          this.results.set([]);
          this.featuredAds.set([]);
          this.totalResults.set(0);
          this.loading.set(false);
        },
      });
  }

  private updateUrlAndSearch(): void {
    const queryParams: Record<string, string | number | null> = {};
    const q = this.query();
    if (q) queryParams['q'] = q;
    const cat = this.selectedCategoryId();
    if (cat) queryParams['category'] = cat;
    const sort = this.sortBy();
    if (sort !== SearchSortOption.RELEVANCE) queryParams['sort'] = sort;
    const page = this.currentPage();
    if (page > 1) queryParams['page'] = page;
    const min = this.minPrice();
    if (min !== null) queryParams['minPrice'] = min;
    const max = this.maxPrice();
    if (max !== null) queryParams['maxPrice'] = max;
    const condition = this.selectedCondition();
    if (condition) queryParams['condition'] = condition;

    const dynamic = this.filterValues();
    Object.entries(dynamic).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams[key] = String(value);
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
    });
  }
}
