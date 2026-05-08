import { Component, OnInit, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ShortsService, ShortVideo } from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { ShortsPlayerComponent } from '../shorts-player/shorts-player.component';
import { Category, Province } from '../../../core/models';

@Component({
  selector: 'app-shorts-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ShortsPlayerComponent],
  templateUrl: './shorts-feed.component.html',
  styleUrl: './shorts-feed.component.scss',
  host: { style: 'display: block; overflow: hidden;' },
})
export class ShortsFeedComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly shorts = signal<ShortVideo[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  readonly activeIndex = signal(0);
  readonly isMuted = signal(true);

  // Filter state
  readonly openFilter = signal<'category' | 'location' | null>(null);

  // Category drill-down
  readonly catLevel = signal(1);
  readonly catSearch = signal('');
  readonly catParentId = signal<string | null>(null);
  readonly catItems = signal<Category[]>([]);
  selectedCategory = '';
  selectedCategoryName = '';

  // Location drill-down
  readonly locLevel = signal(1); // 1=province, 2=city, 3=area
  readonly locSearch = signal('');
  readonly locItems = signal<Array<{ _id: string; name: string }>>([]);
  selectedProvinceId = '';
  selectedProvinceName = '';
  selectedCityId = '';
  selectedCityName = '';

  private limit = 10;
  private seenIds: string[] = [];
  private seed = '';

  constructor(
    private readonly shortsService: ShortsService,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
    private readonly route: ActivatedRoute,
    private readonly elRef: ElementRef,
    private readonly tracker: ActivityTrackerService,
  ) {}

  // Computed labels
  categoryLabel = computed(() => this.selectedCategoryName || 'All Categories');
  locationLabel = computed(() => {
    if (this.selectedCityName) return this.selectedCityName;
    if (this.selectedProvinceName) return this.selectedProvinceName;
    return 'All Locations';
  });

  // Filtered items for search
  filteredCatItems = computed(() => {
    const q = this.catSearch().toLowerCase().trim();
    const items = this.catItems();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  });

  filteredLocItems = computed(() => {
    const q = this.locSearch().toLowerCase().trim();
    const items = this.locItems();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    if (params['categoryId']) this.selectedCategory = params['categoryId'];
    if (params['cityId']) this.selectedCityId = params['cityId'];

    this.loadCategories();
    this.loadProvinces();

    // If a specific short ID is provided, load it first then fill the rest
    if (params['id']) {
      this.loadSpecificShort(params['id']);
    } else {
      this.loadShorts();
    }
  }

  private loadSpecificShort(shortId: string): void {
    this.loading.set(true);
    this.shortsService.getShortById(shortId).subscribe({
      next: (short) => {
        this.shorts.set([short]);
        this.seenIds = [short._id];
        this.loading.set(false);
        // Immediately load more shorts after the specific one
        this.loadMore();
      },
      error: () => {
        this.loadShorts();
      },
    });
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.openFilter.set(null);
  }

  toggleMute(): void {
    this.isMuted.update((v) => !v);
  }

  toggleFilter(type: 'category' | 'location'): void {
    if (this.openFilter() === type) {
      this.openFilter.set(null);
    } else {
      this.openFilter.set(type);
      if (type === 'category') {
        this.catLevel.set(1);
        this.catParentId.set(null);
        this.catSearch.set('');
        this.showCatLevel1();
      } else {
        this.locLevel.set(1);
        this.locSearch.set('');
        this.locItems.set(this.provinces() as any);
      }
    }
  }

  // ─── Category ─────────────────────────────────────────
  private loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => this.categories.set(Array.isArray(cats) ? cats : []),
    });
  }

  private showCatLevel1(): void {
    const items = this.categories()
      .filter((c) => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    this.catItems.set(items);
  }

  hasChildren(cat: Category): boolean {
    return this.categories().some((c) => c.parentId === cat._id && c.isActive);
  }

  selectCatItem(cat: Category): void {
    const children = this.categories()
      .filter((c) => c.parentId === cat._id && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (children.length > 0) {
      // Drill deeper
      this.catLevel.update((l) => l + 1);
      this.catParentId.set(cat._id);
      this.catItems.set(children);
      this.catSearch.set('');
    } else {
      // Leaf — select and close
      this.selectedCategory = cat._id;
      this.selectedCategoryName = cat.name;
      this.openFilter.set(null);
      this.applyFilters();
    }
  }

  catGoBack(): void {
    const currentParent = this.catParentId();
    if (!currentParent) return;

    const parent = this.categories().find((c) => c._id === currentParent);
    if (parent?.parentId) {
      // Go to parent's siblings
      const grandparent = parent.parentId;
      const siblings = this.categories()
        .filter((c) => c.parentId === grandparent && c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      this.catItems.set(siblings);
      this.catParentId.set(grandparent);
    } else {
      // Back to level 1
      this.showCatLevel1();
      this.catParentId.set(null);
    }
    this.catLevel.update((l) => Math.max(1, l - 1));
    this.catSearch.set('');
  }

  clearCategoryFilter(): void {
    this.selectedCategory = '';
    this.selectedCategoryName = '';
    this.openFilter.set(null);
    this.applyFilters();
  }

  // ─── Location ─────────────────────────────────────────
  private loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces) => this.provinces.set(provinces),
    });
  }

  selectLocItem(item: { _id: string; name: string }): void {
    const level = this.locLevel();
    if (level === 1) {
      // Selected province → load cities
      this.selectedProvinceId = item._id;
      this.selectedProvinceName = item.name;
      this.locLevel.set(2);
      this.locSearch.set('');
      this.locationService.getCities(item._id).subscribe({
        next: (cities) => this.locItems.set(cities as any),
      });
    } else if (level === 2) {
      // Selected city → apply filter
      this.selectedCityId = item._id;
      this.selectedCityName = item.name;
      this.openFilter.set(null);
      this.applyFilters();
    }
  }

  locGoBack(): void {
    const level = this.locLevel();
    if (level === 2) {
      // Back to provinces
      this.locLevel.set(1);
      this.locItems.set(this.provinces() as any);
      this.selectedCityId = '';
      this.selectedCityName = '';
      this.locSearch.set('');
    }
  }

  clearLocationFilter(): void {
    this.selectedProvinceId = '';
    this.selectedProvinceName = '';
    this.selectedCityId = '';
    this.selectedCityName = '';
    this.openFilter.set(null);
    this.applyFilters();
  }

  // ─── Data loading ─────────────────────────────────────
  private loadShorts(): void {
    this.loading.set(true);
    this.seenIds = [];
    this.seed = '';
    this.shortsService.getFeed(1, this.limit, this.getFilters()).subscribe({
      next: (res: any) => {
        this.shorts.set(res.data);
        this.seed = res.seed || '';
        this.seenIds = res.data.map((s: any) => s._id);
        this.hasMore.set(res.data.length > 0 && res.data.length < res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    this.tracker.track(TrackingEvent.SHORT_FEED_FILTER, {
      metadata: { categoryId: this.selectedCategory || null, cityId: this.selectedCityId || null },
    });
    this.loadShorts();
  }

  clearFilters(): void {
    this.selectedCategory = '';
    this.selectedCategoryName = '';
    this.selectedProvinceId = '';
    this.selectedProvinceName = '';
    this.selectedCityId = '';
    this.selectedCityName = '';
    this.loadShorts();
  }

  hasActiveFilters(): boolean {
    return !!(this.selectedCategory || this.selectedCityId);
  }

  loadMore(): void {
    this.loadingMore.set(true);
    this.shortsService.getFeed(1, this.limit, this.getFilters()).subscribe({
      next: (res: any) => {
        const newShorts = res.data.filter((s: any) => !this.seenIds.includes(s._id));
        this.shorts.update((current) => [...current, ...newShorts]);
        this.seenIds.push(...newShorts.map((s: any) => s._id));
        this.hasMore.set(newShorts.length > 0);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  private getFilters(): Record<string, string> {
    const filters: Record<string, string> = {};
    if (this.selectedCategory) filters['categoryId'] = this.selectedCategory;
    if (this.selectedCityId) filters['cityId'] = this.selectedCityId;
    if (this.seed) filters['seed'] = this.seed;
    if (this.seenIds.length > 0) filters['seen'] = this.seenIds.join(',');
    return filters;
  }

  onContainerScroll(event: Event): void {
    const container = event.target as HTMLElement;
    if (container) {
      const cardHeight = container.clientHeight;
      const index = Math.round(container.scrollTop / cardHeight);
      if (index !== this.activeIndex()) {
        this.activeIndex.set(index);
        // Track view when a new short becomes visible
        const short = this.shorts()[index];
        if (short) {
          this.tracker.track(TrackingEvent.SHORT_VIEW, {
            metadata: { shortId: short._id, index, sellerId: short.sellerId?._id },
          });
        }
      }
      // Load more when near the end
      if (
        this.hasMore() &&
        !this.loadingMore() &&
        container.scrollTop + cardHeight >= container.scrollHeight - cardHeight
      ) {
        this.loadMore();
      }
    }
  }
}
