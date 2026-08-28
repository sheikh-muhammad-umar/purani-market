import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  ViewChild,
  HostListener,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import {
  SearchService,
  SearchParams,
  SearchResponse,
  SearchSuggestion,
} from '../../../core/services/search.service';
import { CategoriesService } from '../../../core/services/categories.service';
import {
  ExperimentsService,
  ExperimentEventType,
} from '../../../core/services/experiments.service';
import { LocationService } from '../../../core/services/location.service';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  STORAGE_SELECTED_LOCATION,
  STORAGE_MOBILE_COLUMNS,
} from '../../../core/constants/storage-keys';
import { DEFAULT_COUNTRY, CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { SORT_OPTIONS, CONDITION_FILTER_OPTIONS } from '../../../core/constants/select-options';
import { SearchSortOption } from '../../../core/constants/enums';
import { ListingCardComponent } from '../../../shared/components/listing-card/listing-card.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { Listing, Category, CategoryAttribute } from '../../../core/models';
import { VehicleModel, VehicleVariant, BrandOption } from '../../../core/models/brand.model';
import { BrandsService } from '../../../core/services/brands.service';

/** Query param keys managed by this component — dynamic filters are anything else */
/** Separator used to keep several multiselect values in one URL param. */
const MULTI_VALUE_SEPARATOR = ',';

/** Quiet period before a typed numeric filter triggers a search. */
const FILTER_INPUT_DEBOUNCE_MS = 400;

const KNOWN_QUERY_PARAMS = new Set([
  'q',
  'category',
  'sort',
  'page',
  'minPrice',
  'maxPrice',
  'condition',
  'verifiedSeller',
  // Brand chain: previously absent from the URL entirely, so a reloaded or
  // shared link dropped these filters even though the chips and the API call
  // had applied them.
  'brand',
  'model',
  'variant',
]);

import {
  OTHER_OPTION_VALUE,
  attributeSelectOptions,
  attributeYearOptions,
} from '../../../core/utils/category-attributes';
import { SearchFacet } from '../../../core/services/search.service';
import { ActiveFilter } from './search-results.types';
import { AdBannerComponent } from '../../../shared/components/ad-banner/ad-banner.component';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CustomSelectComponent,
    AdBannerComponent,
    ListingCardComponent,
    SectionHeaderComponent,
    EmptyStateComponent,
    PaginationComponent,
  ],
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.scss'],
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly SKELETON_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8];

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly query = signal('');
  readonly results = signal<Listing[]>([]);
  readonly featuredAds = signal<Listing[]>([]);
  readonly totalResults = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly sortBy = signal<SearchSortOption>(SearchSortOption.RELEVANCE);
  /** null = no user interaction yet (CSS handles default), true/false = user toggled */
  readonly filtersOpen = signal<boolean | null>(null);

  /**
   * Single source of truth for the mobile breakpoint, driven by the same 768px
   * value the stylesheet uses. A previous `window.innerWidth >= 768` check
   * disagreed with the CSS `max-width: 768px` at exactly 768px, so the toggle
   * behaved as "desktop" while the panel rendered as a mobile overlay.
   */
  private readonly mobileQuery =
    this.isBrowser && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)')
      : null;
  readonly isMobileViewport = signal(this.mobileQuery?.matches ?? false);

  /** True only when the panel is covering the screen as a mobile overlay. */
  readonly mobileFiltersOpen = computed(
    () => this.isMobileViewport() && this.filtersOpen() === true,
  );

  @ViewChild('filterPanel') private filterPanelEl?: ElementRef<HTMLElement>;
  @ViewChild('filterClose') private filterCloseEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('filterTrigger') private filterTriggerEl?: ElementRef<HTMLButtonElement>;

  /** Filter sections the user has folded away, by section id. */
  readonly collapsedSections = signal<Set<string>>(new Set());
  readonly mobileColumns = signal<1 | 2>(this.loadMobileColumns());

  // Category filters
  readonly categories = signal<Category[]>([]);
  readonly categoriesLoading = signal(true);
  readonly selectedCategoryId = signal<string>('');
  readonly selectedCategorySlug = signal<string>('');
  readonly selectedCategory = signal<Category | null>(null);
  readonly categoryFilters = signal<CategoryAttribute[]>([]);

  // Dynamic filter values
  readonly filterValues = signal<Record<string, string | number | boolean>>({});
  readonly activeFilters = signal<ActiveFilter[]>([]);

  /** Per-option result counts for the selected category's filters. */
  readonly facets = signal<SearchFacet[]>([]);

  /** Facets indexed by attribute key for template lookups. */
  private readonly facetsByKey = computed<Map<string, SearchFacet>>(
    () => new Map(this.facets().map((facet) => [facet.key, facet])),
  );

  // Standard filters
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly selectedCondition = signal<string>('');
  readonly verifiedSellerOnly = signal(false);

  // Suggestions
  readonly suggestions = signal<SearchSuggestion[]>([]);
  readonly showSuggestions = signal(false);
  readonly searchInput = signal('');

  // No results state
  readonly relatedCategories = signal<{ _id: string; name: string; slug: string }[]>([]);
  readonly suggestedTerms = signal<string[]>([]);

  readonly hasResults = computed(() => this.results().length > 0 || this.featuredAds().length > 0);
  readonly totalPages = computed(() => Math.ceil(this.totalResults() / this.pageSize));

  readonly expandedCategories = signal<Set<string>>(new Set());

  /** Precomputed subcategories map — avoids filtering the full list on every CD cycle */
  readonly subcategoriesMap = computed(() => {
    const map = new Map<string, Category[]>();
    for (const cat of this.categories()) {
      if (!cat.isActive) continue;
      const parentId = cat.parentId || '';
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(cat);
    }
    return map;
  });

  // Province/City for province_city attribute type
  readonly provinces = signal<{ _id: string; name: string }[]>([]);
  readonly provinceCities = signal<Record<string, { _id: string; name: string }[]>>({});

  // Brand / Model / Variant filters
  readonly hasBrandsFilter = signal(false);
  readonly isVehicleCategoryFilter = signal(false);
  readonly filterBrands = signal<BrandOption[]>([]);
  readonly filterModels = signal<VehicleModel[]>([]);
  readonly filterVariants = signal<VehicleVariant[]>([]);
  readonly selectedFilterBrandId = signal<string>('');
  readonly selectedFilterModelId = signal<string>('');
  readonly selectedFilterVariantId = signal<string>('');

  readonly brandFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Brands' },
    ...this.filterBrands().map((b) => ({ value: b._id, label: b.name })),
  ]);

  readonly modelFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Models' },
    ...this.filterModels().map((m) => ({ value: m._id, label: m.name })),
  ]);

  readonly variantFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Variants' },
    ...this.filterVariants().map((v) => ({ value: v._id, label: v.name })),
  ]);

  readonly provinceOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Provinces' },
    ...this.provinces().map((p) => ({ value: p.name, label: p.name })),
  ]);

  getCityOptions(provinceName: string): SelectOption[] {
    const cities = this.provinceCities()[provinceName] || [];
    return [
      { value: '', label: 'All Cities' },
      ...cities.map((c) => ({ value: c.name, label: c.name })),
    ];
  }

  /**
   * Options for a select-style filter.
   *
   * Built from the shared attribute helper so the filter panel and the listing
   * forms agree on what an attribute offers. The previous local copy hardcoded a
   * `!== 'Other'` exclusion, which hid the literal option "Other" from filtering
   * even for categories that legitimately offer it.
   */
  getSelectFilterOptions(filter: CategoryAttribute): SelectOption[] {
    return this.selectFilterOptions().get(filter.key) ?? [];
  }

  /**
   * Select options per attribute key, rebuilt only when the definitions change.
   *
   * These are read from the template, so returning a freshly allocated array on
   * every call handed the child selects a new input identity on each
   * change-detection pass.
   */
  private readonly selectFilterOptions = computed<Map<string, SelectOption[]>>(() => {
    const map = new Map<string, SelectOption[]>();
    const facets = this.facetsByKey();
    const values = this.filterValues();

    for (const filter of this.categoryFilters()) {
      if (filter.type !== 'select') continue;

      const counts = facets.get(filter.key)?.buckets;
      const selected = String(values[filter.key] ?? '');
      const options: SelectOption[] = [];

      for (const opt of attributeSelectOptions(filter, 'Any')) {
        if (opt.value === OTHER_OPTION_VALUE) continue;

        // The placeholder entry, and every option when counts aren't in yet.
        if (!opt.value || !counts) {
          options.push(opt);
          continue;
        }

        const count = counts.find((b) => b.value === opt.value)?.count ?? 0;
        // Drop dead ends, but never hide what is currently applied or the
        // control would look empty while a filter is active.
        if (count === 0 && opt.value !== selected) continue;

        options.push({ ...opt, label: `${opt.label} (${count})` });
      }

      map.set(filter.key, options);
    }
    return map;
  });

  /**
   * Year options for one half of a From/To pair.
   *
   * The two lists are constrained against each other so an impossible span
   * cannot be selected — previously both offered the full range, so From 2024 /
   * To 1990 was one click away and returned nothing.
   */
  getYearFilterOptions(filter: CategoryAttribute, suffix: '_min' | '_max'): SelectOption[] {
    const pair = this.yearFilterOptions().get(filter.key);
    if (!pair) return [];
    return suffix === '_min' ? pair.min : pair.max;
  }

  /**
   * From/To year options per attribute key, recomputed when the definitions or
   * the chosen bounds change. Each list is constrained by the opposite bound so
   * an impossible span cannot be selected.
   */
  private readonly yearFilterOptions = computed<
    Map<string, { min: SelectOption[]; max: SelectOption[] }>
  >(() => {
    const map = new Map<string, { min: SelectOption[]; max: SelectOption[] }>();
    for (const filter of this.categoryFilters()) {
      if (filter.type !== 'year') continue;
      const years = attributeYearOptions(filter);
      const chosenMin = this.numericFilterValue(filter.key + '_min');
      const chosenMax = this.numericFilterValue(filter.key + '_max');
      const toOption = (yr: number) => ({ value: yr.toString(), label: yr.toString() });
      map.set(filter.key, {
        min: [
          { value: '', label: 'From' },
          ...years.filter((yr) => chosenMax === null || yr <= chosenMax).map(toOption),
        ],
        max: [
          { value: '', label: 'To' },
          ...years.filter((yr) => chosenMin === null || yr >= chosenMin).map(toOption),
        ],
      });
    }
    return map;
  });

  /** Parses a stored filter value as a number, or `null` when unusable. */
  private numericFilterValue(key: string): number | null {
    const raw = this.filterValues()[key];
    if (raw === undefined || raw === '' || raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Shows the attribute's own bounds as the input hint when it defines them. */
  rangePlaceholder(filter: CategoryAttribute, bound: 'min' | 'max'): string {
    // Prefer what actually exists in the current results over the abstract
    // definition bounds: "2018" is a more useful hint than "1970".
    const observed = this.facetBounds(filter.key);
    const fromFacet = bound === 'min' ? observed?.min : observed?.max;
    if (fromFacet !== null && fromFacet !== undefined) return String(fromFacet);

    const value = bound === 'min' ? filter.rangeMin : filter.rangeMax;
    const fallback = bound === 'min' ? 'Min' : 'Max';
    return value === undefined || value === null ? fallback : String(value);
  }

  /**
   * Validation message for a from/to pair, or `''` when it is usable.
   *
   * Nothing checked ordering before, so a reversed span silently returned zero
   * results with no indication why.
   */
  rangeError(key: string): string {
    const def = this.categoryFilters().find((f) => f.key === key);
    const min = this.numericFilterValue(key + '_min');
    const max = this.numericFilterValue(key + '_max');

    if (min !== null && max !== null && min > max) {
      return 'Minimum cannot be greater than maximum.';
    }
    if (def) {
      if (def.rangeMin !== undefined && def.rangeMin !== null) {
        if ((min !== null && min < def.rangeMin) || (max !== null && max < def.rangeMin)) {
          return `Must be ${def.rangeMin} or more.`;
        }
      }
      if (def.rangeMax !== undefined && def.rangeMax !== null) {
        if ((min !== null && min > def.rangeMax) || (max !== null && max > def.rangeMax)) {
          return `Must be ${def.rangeMax} or less.`;
        }
      }
    }
    return '';
  }

  /** Validation message for the price pair, or `''` when it is usable. */
  priceError(): string {
    const min = this.minPrice();
    const max = this.maxPrice();
    if (min !== null && min < 0) return 'Price cannot be negative.';
    if (max !== null && max < 0) return 'Price cannot be negative.';
    if (min !== null && max !== null && min > max) {
      return 'Minimum price cannot be greater than maximum.';
    }
    return '';
  }

  readonly conditionOptions = CONDITION_FILTER_OPTIONS;
  readonly sortOptions = SORT_OPTIONS;

  /**
   * Resolves a filterValues key to a human label.
   *
   * Range filters are stored under suffixed keys (`year_min`), which match no
   * attribute definition — so chips used to fall back to the raw key and read
   * "year_min: 2022".
   */
  private describeFilterKey(key: string): { label: string; qualifier: string } {
    // An attribute matching the whole key takes precedence, so a key that merely
    // looks suffixed is not relabelled as someone else's bound.
    const own = this.categoryFilters().find((f) => f.key === key);
    if (own) return { label: own.name, qualifier: '' };

    const rangeMatch = key.match(/^(.*)_(min|max)$/);
    if (rangeMatch) {
      const def = this.categoryFilters().find((f) => f.key === rangeMatch[1]);
      if (def) {
        return {
          label: def.name,
          qualifier: rangeMatch[2] === 'min' ? ' from' : ' up to',
        };
      }
    }
    return { label: key, qualifier: '' };
  }

  /**
   * True for attribute types the sidebar renders as a from/to pair, and which
   * the API therefore expects as a `{ min, max }` object.
   */
  /**
   * True when a key is one of the two dropdown halves of a `province_city`
   * attribute (`<base>_province` / `<base>_city`) rather than an attribute in its
   * own right.
   *
   * Checked against the definitions instead of by suffix alone: an attribute may
   * legitimately be called `registration_city`, and treating that as a half made
   * it disappear from the request and from the filter chips.
   */
  private isProvinceCityHalf(key: string): boolean {
    const match = key.match(/^(.*)_(province|city)$/);
    if (!match) return false;
    if (this.categoryFilters().some((f) => f.key === key)) return false;
    return this.categoryFilters().some((f) => f.key === match[1] && f.type === 'province_city');
  }

  private isRangeStyleFilter(key: string): boolean {
    const type = this.categoryFilters().find((f) => f.key === key)?.type;
    return type === 'range' || type === 'number' || type === 'year';
  }

  getYearRange(filter: { rangeMin?: number; rangeMax?: number }): number[] {
    return attributeYearOptions(filter);
  }

  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();
  /** Coalesces rapid typing in numeric filter boxes into a single search. */
  private readonly filterInput$ = new Subject<void>();
  private lastSearchHash = '';
  /**
   * Set when a category change deferred filter reconciliation until the new
   * attribute definitions arrive.
   */
  private pendingFilterReconcile = false;

  isSectionCollapsed(id: string): boolean {
    return this.collapsedSections().has(id);
  }

  toggleSection(id: string): void {
    this.collapsedSections.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Number of filters currently applied, used for the mobile badge. */
  readonly activeFilterCount = computed(() => this.activeFilters().length);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: SearchService,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
    private readonly recentSearches: RecentSearchesService,
    private readonly tracker: ActivityTrackerService,
    private readonly brandsService: BrandsService,
    private readonly experiments: ExperimentsService,
  ) {}

  /**
   * Keeps the page behind the mobile overlay from scrolling.
   *
   * Done imperatively from the few places that change panel or viewport state
   * rather than through `effect()`, which needs an injection context this
   * component is not always constructed in.
   */
  private syncScrollLock(): void {
    if (!this.isBrowser) return;
    document.body.classList.toggle('filters-locked', this.mobileFiltersOpen());
  }

  ngOnInit(): void {
    this.loadCategories();
    this.setupSuggestions();
    this.setupFilterDebounce();
    this.mobileQuery?.addEventListener('change', this.onViewportChange);
    // Pre-fetch experiment assignments (cached for session)
    this.experiments.getAssignments().pipe(takeUntil(this.destroy$)).subscribe();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const q = params.get('q') || '';
      const categorySlug = params.get('category') || '';
      const sort = (params.get('sort') as SearchSortOption) || SearchSortOption.RELEVANCE;
      const page = Number(params.get('page')) || 1;
      const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
      const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
      const condition = params.get('condition') || '';

      this.query.set(q);
      this.searchInput.set(q);
      this.selectedCategorySlug.set(categorySlug);
      this.sortBy.set(sort);
      this.currentPage.set(page);
      this.minPrice.set(minPrice);
      this.maxPrice.set(maxPrice);
      this.selectedCondition.set(condition);
      this.verifiedSellerOnly.set(params.get('verifiedSeller') === 'true');
      this.restoreBrandChain(
        params.get('brand') || '',
        params.get('model') || '',
        params.get('variant') || '',
      );

      // Parse dynamic filter params
      const dynamicFilters: Record<string, string | number | boolean> = {};
      params.keys.forEach((key) => {
        if (!KNOWN_QUERY_PARAMS.has(key)) {
          dynamicFilters[key] = params.get(key) || '';
        }
      });
      this.filterValues.set(dynamicFilters);

      // Resolve slug to category ID if categories are already loaded
      if (categorySlug) {
        const resolved = this.resolveCategorySlug(categorySlug);
        if (resolved) {
          this.selectedCategoryId.set(resolved);
          this.autoExpandCategory(resolved);
          this.loadCategoryFilters(resolved);
          this.executeSearch();
        }
        // If not resolved yet, defer search — loadCategories callback will
        // resolve the slug and trigger executeSearch once categories arrive.
      } else {
        this.selectedCategoryId.set('');
        this.executeSearch();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.mobileQuery) {
      this.mobileQuery.removeEventListener('change', this.onViewportChange);
    }
    if (this.isBrowser) {
      document.body.classList.remove('filters-locked');
    }
  }

  private readonly onViewportChange = (event: MediaQueryListEvent): void => {
    this.isMobileViewport.set(event.matches);
    this.syncScrollLock();
  };

  onSearchInputChange(value: string): void {
    this.searchInput.set(value);
    this.searchInput$.next(value);
  }

  clearSearchInput(): void {
    this.searchInput.set('');
    this.query.set('');
    this.showSuggestions.set(false);
    this.currentPage.set(1);
    this.lastSearchHash = ''; // Reset hash to allow re-search
    this.updateUrlAndSearch();
  }

  onSearchSubmit(): void {
    const newQuery = this.searchInput().trim();
    if (!newQuery && !this.query()) return;
    // Skip if same query and no filter changes
    if (newQuery === this.query() && this.currentPage() === 1) return;
    this.showSuggestions.set(false);
    this.currentPage.set(1);
    this.query.set(newQuery);
    this.recentSearches.add(newQuery);
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

  onSortChange(sort: SearchSortOption): void {
    this.sortBy.set(sort);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onCategoryChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    // Look up slug for the URL
    const cat = this.categories().find((c) => c._id === categoryId);
    this.selectedCategorySlug.set(cat?.slug || '');
    // Dynamic filters used to be wiped on every category change, so moving
    // between siblings that share inherited attributes (Cars -> Motorcycles both
    // have `year`) needlessly threw the selection away. Values are kept
    // provisionally and reconciled against the new definitions once they load.
    this.pendingFilterReconcile = categoryId !== '';
    if (!categoryId) this.filterValues.set({});
    this.currentPage.set(1);
    if (categoryId) {
      this.loadCategoryFilters(categoryId);
    } else {
      this.categoryFilters.set([]);
      this.selectedCategory.set(null);
      this.clearBrandFilters();
    }
    this.updateUrlAndSearch();
  }

  onConditionChange(condition: string): void {
    this.selectedCondition.set(condition);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onVerifiedSellerChange(checked: boolean): void {
    this.verifiedSellerOnly.set(checked);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onPriceFilterApply(): void {
    if (this.priceError()) return;
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onDynamicFilterChange(key: string, value: string): void {
    this.applyDynamicFilter(key, value);
    this.updateUrlAndSearch();
  }

  /**
   * Same as `onDynamicFilterChange` but debounced, for filters typed into a free
   * text box. Every keystroke used to trigger a router navigation and a search,
   * so entering "50000" fired five of each.
   */
  onDynamicFilterInput(key: string, value: string): void {
    this.applyDynamicFilter(key, value);
    this.filterInput$.next();
  }

  /** Number of results a given option would yield, or `null` when unknown. */
  facetCount(key: string, option: string): number | null {
    const bucket = this.facetsByKey()
      .get(key)
      ?.buckets?.find((b) => b.value === option);
    return bucket ? bucket.count : null;
  }

  /**
   * True when an option would return nothing.
   *
   * Only treated as empty once facets have actually loaded for this attribute —
   * otherwise every option would look unavailable on first paint.
   */
  isOptionUnavailable(key: string, option: string): boolean {
    const facet = this.facetsByKey().get(key);
    if (!facet?.buckets) return false;
    return !facet.buckets.some((b) => b.value === option && b.count > 0);
  }

  /** Observed bounds for a numeric attribute, used as input hints. */
  facetBounds(key: string): { min: number | null; max: number | null } | null {
    const facet = this.facetsByKey().get(key);
    if (!facet || facet.buckets) return null;
    if (facet.min === null && facet.max === null) return null;
    return { min: facet.min ?? null, max: facet.max ?? null };
  }

  /** Whether one option of a multiselect filter is currently chosen. */
  isMultiSelected(key: string, option: string): boolean {
    return this.multiSelectValues(key).includes(option);
  }

  /**
   * Adds or removes one option of a multiselect filter.
   *
   * Multiselect used to render the same single-value dropdown as `select`, so
   * only one option could ever be applied even though both the URL encoding and
   * the backend's `terms` clause already supported several.
   */
  toggleMultiSelectFilter(key: string, option: string): void {
    const current = this.multiSelectValues(key);
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    this.applyDynamicFilter(key, next.join(MULTI_VALUE_SEPARATOR));
    this.updateUrlAndSearch();
  }

  private multiSelectValues(key: string): string[] {
    const raw = this.filterValues()[key];
    if (raw === undefined || raw === null || raw === '') return [];
    return String(raw)
      .split(MULTI_VALUE_SEPARATOR)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private applyDynamicFilter(key: string, value: string): void {
    const current = { ...this.filterValues() };
    if (value === '' || value === null || value === undefined) {
      delete current[key];
    } else {
      current[key] = value;
    }
    this.filterValues.set(current);
    this.currentPage.set(1);
  }

  /**
   * Drops filter values the newly selected category does not define, keeping the
   * ones it shares. Suffixed range keys (`year_min`) are matched back to their
   * base attribute.
   */
  private reconcileFilterValues(): void {
    const known = new Set(this.categoryFilters().map((f) => f.key));
    this.filterValues.update((values) => {
      const kept: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(values)) {
        // Keep an attribute matched by its own key, or a suffixed half/bound
        // whose base attribute the new category still defines.
        if (known.has(key)) {
          kept[key] = value;
          continue;
        }
        const base = key.match(/^(.*)_(min|max|province|city)$/)?.[1];
        if (base && known.has(base)) kept[key] = value;
      }
      return kept;
    });
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'category') {
      this.onCategoryChange('');
    } else if (filter.key === 'condition') {
      this.onConditionChange('');
    } else if (filter.key === 'verifiedSeller') {
      this.onVerifiedSellerChange(false);
    } else if (filter.key === 'minPrice' || filter.key === 'maxPrice') {
      if (filter.key === 'minPrice') this.minPrice.set(null);
      if (filter.key === 'maxPrice') this.maxPrice.set(null);
      this.currentPage.set(1);
      this.updateUrlAndSearch();
    } else if (filter.key === 'brandFilter') {
      this.onBrandFilterChange('');
    } else if (filter.key === 'modelFilter') {
      this.onModelFilterChange('');
    } else if (filter.key === 'variantFilter') {
      this.onVariantFilterChange('');
    } else {
      this.onDynamicFilterChange(filter.key, '');
    }
  }

  clearAllFilters(): void {
    this.selectedCategoryId.set('');
    this.selectedCategorySlug.set('');
    this.selectedCondition.set('');
    this.verifiedSellerOnly.set(false);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.filterValues.set({});
    this.categoryFilters.set([]);
    this.selectedCategory.set(null);
    this.clearBrandFilters();
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  // Category tree helpers
  getSubcategories(parentId: string): Category[] {
    return this.subcategoriesMap().get(parentId) || [];
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
    this.expandedCategories.update((set) => {
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
    // Find the category and expand all its ancestors + itself
    const cats = this.categories();
    const toExpand = new Set<string>();
    let current = cats.find((c) => c._id === catId);
    // Expand the selected category itself so its children are visible
    if (current) {
      toExpand.add(catId);
    }
    while (current?.parentId) {
      toExpand.add(current.parentId);
      current = cats.find((c) => c._id === current!.parentId);
    }
    if (toExpand.size > 0) {
      this.expandedCategories.update((set) => {
        const next = new Set(set);
        toExpand.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  toggleFilters(): void {
    const current = this.filtersOpen();
    // First toggle flips whatever CSS is currently showing: the sidebar is
    // expanded by default on desktop and hidden on mobile.
    if (current === null) {
      this.filtersOpen.set(this.isMobileViewport());
    } else {
      this.filtersOpen.set(!current);
    }
    this.syncScrollLock();
    if (this.filtersOpen() === true && this.isMobileViewport()) {
      this.focusFilterPanel();
    }
  }

  /** Closes the mobile filter panel and returns focus to the button that opened it. */
  closeFilters(): void {
    this.filtersOpen.set(false);
    this.syncScrollLock();
    if (!this.isBrowser) return;
    // Defer so the element is focusable again after the panel is hidden.
    setTimeout(() => this.filterTriggerEl?.nativeElement?.focus());
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.mobileFiltersOpen()) this.closeFilters();
  }

  /**
   * Keeps Tab within the filter panel while it covers the screen on mobile.
   * Without this, tabbing walked into the page behind the overlay.
   */
  @HostListener('document:keydown', ['$event'])
  protected onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    if (!this.mobileFiltersOpen()) return;
    const panel = this.filterPanelEl?.nativeElement;
    if (!panel) return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    }
  }

  private focusFilterPanel(): void {
    if (!this.isBrowser) return;
    setTimeout(() => this.filterCloseEl?.nativeElement?.focus());
  }

  toggleMobileColumns(): void {
    this.mobileColumns.update((c) => {
      const next = c === 2 ? 1 : 2;
      if (this.isBrowser) {
        localStorage.setItem(STORAGE_MOBILE_COLUMNS, String(next));
      }
      return next;
    });
  }

  private loadMobileColumns(): 1 | 2 {
    if (this.isBrowser) {
      return localStorage.getItem(STORAGE_MOBILE_COLUMNS) === '1' ? 1 : 2;
    }
    return 2;
  }

  loadPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.updateUrlAndSearch();
  }

  buildActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const catId = this.selectedCategoryId();
    if (catId) {
      const cat = this.categories().find((c) => c._id === catId);
      filters.push({
        key: 'category',
        label: 'Category',
        value: catId,
        displayValue: cat?.name || catId,
      });
    }
    const condition = this.selectedCondition();
    if (condition) {
      filters.push({
        key: 'condition',
        label: 'Condition',
        value: condition,
        displayValue: condition.charAt(0).toUpperCase() + condition.slice(1),
      });
    }
    if (this.verifiedSellerOnly()) {
      filters.push({
        key: 'verifiedSeller',
        label: 'Verified Seller',
        value: 'true',
        displayValue: 'Verified Sellers Only',
      });
    }
    const min = this.minPrice();
    if (min !== null) {
      filters.push({
        key: 'minPrice',
        label: 'Min Price',
        value: String(min),
        displayValue: `Min: ${CURRENCY_SYMBOL} ${min}`,
      });
    }
    const max = this.maxPrice();
    if (max !== null) {
      filters.push({
        key: 'maxPrice',
        label: 'Max Price',
        value: String(max),
        displayValue: `Max: ${CURRENCY_SYMBOL} ${max}`,
      });
    }
    const dynamic = this.filterValues();
    Object.entries(dynamic).forEach(([key, value]) => {
      if (value === undefined || value === '') return;

      // province_city stores a combined value plus a _province/_city pair. Only
      // the combined entry becomes a chip, otherwise one choice produced three
      // chips and removing one left the others applied.
      if (this.isProvinceCityHalf(key)) return;

      const { label, qualifier } = this.describeFilterKey(key);
      filters.push({
        key,
        label,
        value: String(value),
        displayValue: `${label}${qualifier}: ${value}`,
      });
    });

    // Brand / Model / Variant active filters
    const brandId = this.selectedFilterBrandId();
    if (brandId) {
      const brand = this.filterBrands().find((b) => b._id === brandId);
      filters.push({
        key: 'brandFilter',
        label: 'Brand',
        value: brandId,
        displayValue: `Brand: ${brand?.name || brandId}`,
      });
    }
    const modelId = this.selectedFilterModelId();
    if (modelId) {
      const model = this.filterModels().find((m) => m._id === modelId);
      filters.push({
        key: 'modelFilter',
        label: 'Model',
        value: modelId,
        displayValue: `Model: ${model?.name || modelId}`,
      });
    }
    const variantId = this.selectedFilterVariantId();
    if (variantId) {
      const variant = this.filterVariants().find((v) => v._id === variantId);
      filters.push({
        key: 'variantFilter',
        label: 'Variant',
        value: variantId,
        displayValue: `Variant: ${variant?.name || variantId}`,
      });
    }

    return filters;
  }

  private setupFilterDebounce(): void {
    this.filterInput$
      .pipe(debounceTime(FILTER_INPUT_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => this.updateUrlAndSearch());
  }

  private setupSuggestions(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 2) {
            // Show recent searches when input is empty or short
            const recent = this.recentSearches
              .filter(term)
              .map((t) => ({ term: t, type: 'recent' as const }));
            return of(recent);
          }
          return this.searchService.getSuggestions(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((suggestions) => {
        this.suggestions.set(suggestions);
        this.showSuggestions.set(suggestions.length > 0);
      });
  }

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.categoriesService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cats) => {
          this.categories.set(cats);
          this.categoriesLoading.set(false);
          // Resolve pending category slug now that categories are available
          const slug = this.selectedCategorySlug();
          if (slug && !this.selectedCategoryId()) {
            const resolved = this.resolveCategorySlug(slug);
            if (resolved) {
              this.selectedCategoryId.set(resolved);
              this.autoExpandCategory(resolved);
              this.loadCategoryFilters(resolved);
              this.lastSearchHash = ''; // Reset to allow re-search with resolved ID
              this.executeSearch();
            }
          }
          // Rebuild active filters and re-expand category tree now that names are available
          if (this.selectedCategoryId()) {
            this.activeFilters.set(this.buildActiveFilters());
            this.autoExpandCategory(this.selectedCategoryId());
          }
        },
        error: () => {
          this.categories.set([]);
          this.categoriesLoading.set(false);
        },
      });
  }

  /**
   * Resolve a category slug to its _id from the loaded categories list.
   * Returns the _id if found, empty string otherwise.
   */
  private resolveCategorySlug(slug: string): string {
    const cat = this.categories().find((c) => c.slug === slug);
    return cat?._id || '';
  }

  private loadCategoryFilters(categoryId: string): void {
    // Use the already-loaded categories list instead of a separate getById call.
    // The flat list from getAll() contains all the fields we need (hasBrands, etc.).
    const localCat = this.categories().find((c) => c._id === categoryId) || null;
    this.selectedCategory.set(localCat);
    if (localCat) {
      this.loadBrandsForFilter(localCat);
    } else {
      this.clearBrandFilters();
    }

    this.categoriesService
      .getInheritedAttributes(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ attributes }) => {
          this.categoryFilters.set((attributes || []).filter((a) => a.type !== 'text'));
          if (attributes?.some((a) => a.type === 'province_city')) {
            this.loadProvinces();
          }

          // Encoding a dynamic filter for the API needs its definition: a
          // from/to pair has to become `filters[key][min]`, and without the
          // definition it went out as `filters[key_min]`, which matches no
          // attribute and was dropped server-side. On a deep link the first
          // search ran before these definitions arrived, so shared URLs came
          // back unfiltered. Re-run now that we can encode correctly —
          // executeSearch's hash guard makes this a no-op when nothing changed.
          if (this.pendingFilterReconcile) {
            this.pendingFilterReconcile = false;
            this.reconcileFilterValues();
          }

          this.activeFilters.set(this.buildActiveFilters());
          this.executeSearch();
        },
        error: () => {
          this.categoryFilters.set([]);
        },
      });
  }

  private loadBrandsForFilter(cat: Category): void {
    // Walk up the category tree to find the hasBrands ancestor
    const allCats = this.categories();
    let current: Category | undefined = cat;
    let brandCat: Category | undefined;
    while (current) {
      if (current.hasBrands) {
        brandCat = current;
        break;
      }
      current = current.parentId ? allCats.find((c) => c._id === current!.parentId) : undefined;
    }
    if (!brandCat) {
      this.clearBrandFilters();
      return;
    }
    this.hasBrandsFilter.set(true);

    // Build category path for vehicle brand check
    const catPath: string[] = [];
    let walk: Category | undefined = cat;
    while (walk) {
      catPath.push(walk._id);
      walk = walk.parentId ? allCats.find((c) => c._id === walk!.parentId) : undefined;
    }

    // Check each category in the path for vehicle brands (data-driven)
    let checked = 0;
    let found = false;
    const finalBrandCat = brandCat;
    for (const catId of catPath) {
      this.brandsService
        .checkVehicleCategory(catId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            checked++;
            if (result.hasVehicleBrands && !found) {
              found = true;
              this.isVehicleCategoryFilter.set(true);
              this.brandsService
                .getVehicleBrandsByCategory(catId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (brands) =>
                    this.filterBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
                  error: () => this.filterBrands.set([]),
                });
            }
            if (checked === catPath.length && !found) {
              this.isVehicleCategoryFilter.set(false);
              this.brandsService
                .getByCategory(finalBrandCat._id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (brands) =>
                    this.filterBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
                  error: () => this.filterBrands.set([]),
                });
            }
          },
          error: () => {
            checked++;
            if (checked === catPath.length && !found) {
              this.isVehicleCategoryFilter.set(false);
              this.brandsService
                .getByCategory(finalBrandCat._id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (brands) =>
                    this.filterBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
                  error: () => this.filterBrands.set([]),
                });
            }
          },
        });
    }
  }

  /**
   * Reapplies a brand/model/variant selection restored from the URL, refetching
   * the dependent option lists so the dropdowns can show names rather than ids.
   */
  private restoreBrandChain(brandId: string, modelId: string, variantId: string): void {
    const changed =
      brandId !== this.selectedFilterBrandId() ||
      modelId !== this.selectedFilterModelId() ||
      variantId !== this.selectedFilterVariantId();
    if (!changed) return;

    this.selectedFilterBrandId.set(brandId);
    this.selectedFilterModelId.set(modelId);
    this.selectedFilterVariantId.set(variantId);

    if (!brandId) {
      this.filterModels.set([]);
      this.filterVariants.set([]);
      return;
    }

    if (modelId) {
      this.brandsService
        .getModelsByBrand(brandId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (models) => this.filterModels.set(models),
          error: () => this.filterModels.set([]),
        });
      this.brandsService
        .getVariantsByModel(modelId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (variants) => this.filterVariants.set(variants),
          error: () => this.filterVariants.set([]),
        });
    } else {
      this.brandsService
        .getModelsByBrand(brandId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (models) => this.filterModels.set(models),
          error: () => this.filterModels.set([]),
        });
    }
  }

  private clearBrandFilters(): void {
    this.hasBrandsFilter.set(false);
    this.isVehicleCategoryFilter.set(false);
    this.filterBrands.set([]);
    this.filterModels.set([]);
    this.filterVariants.set([]);
    this.selectedFilterBrandId.set('');
    this.selectedFilterModelId.set('');
    this.selectedFilterVariantId.set('');
  }

  onBrandFilterChange(brandId: string): void {
    this.selectedFilterBrandId.set(brandId);
    this.selectedFilterModelId.set('');
    this.selectedFilterVariantId.set('');
    this.filterModels.set([]);
    this.filterVariants.set([]);

    if (brandId && this.isVehicleCategoryFilter()) {
      this.brandsService
        .getModelsByBrand(brandId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (models) => this.filterModels.set(models),
          error: () => this.filterModels.set([]),
        });
    }
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onModelFilterChange(modelId: string): void {
    this.selectedFilterModelId.set(modelId);
    this.selectedFilterVariantId.set('');
    this.filterVariants.set([]);

    if (modelId) {
      this.brandsService
        .getVariantsByModel(modelId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (variants) => this.filterVariants.set(variants),
          error: () => this.filterVariants.set([]),
        });
    }
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  onVariantFilterChange(variantId: string): void {
    this.selectedFilterVariantId.set(variantId);
    this.currentPage.set(1);
    this.updateUrlAndSearch();
  }

  loadProvinces(): void {
    if (this.provinces().length > 0) return;
    this.locationService
      .getProvinces()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => this.provinces.set(p),
      });
  }

  loadCitiesForProvince(provinceName: string): void {
    if (!provinceName || this.provinceCities()[provinceName]) return;
    const province = this.provinces().find((p) => p.name === provinceName);
    if (!province) return;
    this.locationService
      .getCities(province._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => {
          this.provinceCities.update((m) => ({ ...m, [provinceName]: cities }));
        },
      });
  }

  onProvinceCityChange(attrKey: string, province: string, city: string): void {
    const value = city ? `${province} - ${city}` : province;
    this.filterValues.update((v) => ({
      ...v,
      [attrKey + '_province']: province,
      [attrKey + '_city']: city,
      [attrKey]: value,
    }));
    this.currentPage.set(1);
    this.updateUrlAndSearch();
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
    if (this.verifiedSellerOnly()) params['verifiedSeller'] = true;

    // Location from header selection (persisted in localStorage)
    try {
      const locRaw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== DEFAULT_COUNTRY) {
          if (loc.province?._id) params['provinceId'] = loc.province._id;
          if (loc.city?._id) params['cityId'] = loc.city._id;
          if (loc.area?._id) params['areaId'] = loc.area._id;
        }
      }
    } catch {}

    // Dynamic category attribute filters.
    //
    // These go out as bracketed `filters[...]` keys rather than bare params for
    // two reasons: the API's ValidationPipe runs with forbidNonWhitelisted, so a
    // bare `mileage` param is rejected outright with a 400; and the range types
    // have to arrive as a `{ min, max }` object, which is what
    // SearchService.buildCategoryFilters reads. The flat `mileage_min` shape
    // used internally here (and in the URL, where it stays readable and
    // shareable) is folded into that structure at the boundary.
    for (const [key, value] of Object.entries(this.filterValues())) {
      if (value === undefined || value === '') continue;

      // An attribute whose own key matches wins over any suffix reading, so a
      // real attribute named `registration_city` is not mistaken for the city
      // half of a province/city pair.
      const def = this.categoryFilters().find((f) => f.key === key);

      if (def?.type === 'province_city') {
        // Send the most specific place name, which is what search indexes.
        const city = String(this.filterValues()[`${key}_city`] ?? '').trim();
        const province = String(this.filterValues()[`${key}_province`] ?? '').trim();
        const name = city || province;
        if (name) params[`filters[${key}]`] = name;
        continue;
      }

      if (!def) {
        const rangeMatch = key.match(/^(.*)_(min|max)$/);
        if (rangeMatch && this.isRangeStyleFilter(rangeMatch[1])) {
          // A reversed or out-of-bounds span would just return nothing. Holding
          // it back keeps the results meaningful while the inline message
          // explains what needs correcting.
          if (this.rangeError(rangeMatch[1])) continue;
          params[`filters[${rangeMatch[1]}][${rangeMatch[2]}]`] = value;
          continue;
        }
        // The two halves of a province/city pair are UI state only; the filter
        // travels under the attribute's own key.
        if (this.isProvinceCityHalf(key)) continue;
      }

      if (def?.type === 'multiselect') {
        String(value)
          .split(MULTI_VALUE_SEPARATOR)
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v, i) => {
            params[`filters[${key}][${i}]`] = v;
          });
        continue;
      }

      params[`filters[${key}]`] = value;
    }

    // Brand / Model / Variant filters
    const brandId = this.selectedFilterBrandId();
    if (brandId) {
      if (this.isVehicleCategoryFilter()) {
        params['vehicleBrandId'] = brandId;
      } else {
        params['brandId'] = brandId;
      }
    }
    const modelId = this.selectedFilterModelId();
    if (modelId) params['modelId'] = modelId;
    const variantId = this.selectedFilterVariantId();
    if (variantId) params['variantId'] = variantId;

    // Apply A/B experiment configs to search params.
    // Experiment configs use the same key names the backend accepts
    // (scoreThreshold, rankingConfig, limit, sort, etc.).
    // Each config entry is passed directly as a search param.
    const assignments = this.experiments.getAllAssignments();
    for (const assignment of assignments) {
      const config = assignment.config;
      if (!config || Object.keys(config).length === 0) continue;
      for (const [key, value] of Object.entries(config)) {
        if (value != null && value !== '') {
          // Objects (like ranking weights) are serialized as JSON
          params[key] = typeof value === 'object' ? JSON.stringify(value) : value;
        }
      }
    }

    return params;
  }

  private executeSearch(): void {
    const params = this.buildSearchParams();
    const hash = JSON.stringify(params);
    if (hash === this.lastSearchHash) return;
    this.lastSearchHash = hash;

    this.loading.set(true);
    this.activeFilters.set(this.buildActiveFilters());

    if (params.q) {
      this.tracker.track(TrackingEvent.SEARCH, {
        searchQuery: params.q,
        categoryId: params.category as string | undefined,
        metadata: { sort: params.sort, page: params.page },
      });
    }

    this.searchService
      .search(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: SearchResponse) => {
          this.results.set(res.items || []);
          this.featuredAds.set(res.featuredAds || []);
          this.totalResults.set(res.total);
          this.relatedCategories.set(res.relatedCategories || []);
          this.suggestedTerms.set(res.suggestions || []);
          this.facets.set(res.facets || []);
          this.loading.set(false);
          this.trackSearchImpression(params, res.total);
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
    const slug = this.selectedCategorySlug();
    if (slug) queryParams['category'] = slug;
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
    if (this.verifiedSellerOnly()) queryParams['verifiedSeller'] = 'true';
    const brand = this.selectedFilterBrandId();
    if (brand) queryParams['brand'] = brand;
    const model = this.selectedFilterModelId();
    if (model) queryParams['model'] = model;
    const variant = this.selectedFilterVariantId();
    if (variant) queryParams['variant'] = variant;

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

  // ── Experiment Tracking ─────────────────────────────────────────

  /** Track a search impression for all running experiments */
  private trackSearchImpression(params: SearchParams, totalResults: number): void {
    this.experiments.trackAll(ExperimentEventType.SEARCH_IMPRESSION, {
      searchQuery: params.q,
      totalResults,
      metadata: { category: params.category, sort: params.sort, page: params.page },
    });
  }

  /** Track a click on a search result. Called from the template. */
  onResultClick(listingId: string, position: number): void {
    this.experiments.trackAll(ExperimentEventType.SEARCH_CLICK, {
      searchQuery: this.query(),
      listingId,
      position,
      totalResults: this.totalResults(),
    });
  }
}
