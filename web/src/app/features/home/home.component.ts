import { Component, OnInit, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, map, shareReplay } from 'rxjs';
import { CategoriesService } from '../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../core/services/listings.service';
import { ShortsService, ShortVideo } from '../../core/services/shorts.service';
import { RecommendationsService } from '../../core/services/recommendations.service';
import { AuthService } from '../../core/auth/auth.service';
import { CategoryModalComponent } from '../../shared/components/category-modal/category-modal.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { ListingCardComponent } from '../../shared/components/listing-card/listing-card.component';
import { ShortCardComponent } from '../../shared/components/short-card/short-card.component';
import { CategoryCardComponent } from '../../shared/components/category-card/category-card.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Category, Listing } from '../../core/models';
import { STORAGE_SELECTED_LOCATION } from '../../core/constants/storage-keys';
import {
  DEFAULT_COUNTRY,
  CATEGORY_ICONS_PATH,
  DEFAULT_CATEGORY_ICON,
  FEATURED_ADS_LIMIT,
  NEARBY_LISTINGS_LIMIT,
} from '../../core/constants/app';
import { ROUTES } from '../../core/constants/routes';

interface CategoryChip {
  id: string;
  name: string;
  iconUrl: string;
  slug: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    CategoryModalComponent,
    SearchBarComponent,
    ListingCardComponent,
    ShortCardComponent,
    CategoryCardComponent,
    SectionHeaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly SKELETON_CATEGORIES = Array.from({ length: 8 }, (_, i) => i);
  readonly SKELETON_FEATURED = Array.from({ length: 4 }, (_, i) => i);
  readonly SKELETON_GRID = Array.from({ length: 6 }, (_, i) => i);

  readonly categories = signal<Category[]>([]);
  readonly featuredListings = signal<Listing[]>([]);
  readonly recommendations = signal<Listing[]>([]);
  readonly nearbyListings = signal<Listing[]>([]);
  readonly shorts = signal<ShortVideo[]>([]);
  readonly userCity = signal<string>('');

  readonly loadingCategories = signal(true);
  readonly loadingFeatured = signal(true);
  readonly loadingRecommendations = signal(true);
  readonly loadingNearby = signal(true);
  readonly loadingShorts = signal(true);

  readonly selectedCategory = signal<Category | null>(null);

  readonly categoryChips = computed<CategoryChip[]>(() =>
    this.categories()
      .filter((c) => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c._id,
        name: c.name,
        iconUrl: c.icon ? `${CATEGORY_ICONS_PATH}/${c.icon}` : DEFAULT_CATEGORY_ICON,
        slug: c.slug,
      })),
  );

  private readonly isBrowser: boolean;

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly shortsService: ShortsService,
    private readonly recommendationsService: RecommendationsService,
    public readonly authService: AuthService,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadCategories();

    if (!this.isBrowser) return;

    this.loadFeatured();
    this.loadShorts();
    this.loadRecommendations();
    this.loadNearby();
  }

  openCategoryModal(chip: CategoryChip): void {
    const cat = this.categories().find((c) => c._id === chip.id);
    if (cat) {
      this.selectedCategory.set(cat);
    }
  }

  closeCategoryModal(): void {
    this.selectedCategory.set(null);
  }

  private loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.categories.set(Array.isArray(cats) ? cats : []);
        this.loadingCategories.set(false);
      },
      error: () => this.loadingCategories.set(false),
    });
  }

  private loadFeatured(): void {
    // Get city from selected location for filtering
    let city: string | undefined;
    try {
      const locRaw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== DEFAULT_COUNTRY) {
          city = loc.city?.name;
        }
      }
    } catch {}

    this.listingsService.getFeaturedFiltered({ city, limit: FEATURED_ADS_LIMIT }).subscribe({
      next: (res) => {
        const data = res.data ?? [];
        if (data.length > 0) {
          this.featuredListings.set(data);
        } else {
          this.getLatestListings().subscribe({
            next: (listings) => this.featuredListings.set(listings.slice(0, 10)),
          });
        }
        this.loadingFeatured.set(false);
      },
      error: () => this.loadingFeatured.set(false),
    });
  }

  private loadShorts(): void {
    this.shortsService.getFeed(1, 10).subscribe({
      next: (res) => {
        this.shorts.set(res.data ?? []);
        this.loadingShorts.set(false);
      },
      error: () => this.loadingShorts.set(false),
    });
  }

  private loadRecommendations(): void {
    this.recommendationsService.getRecommendations(20).subscribe({
      next: (listings) => {
        const data = Array.isArray(listings) ? listings : [];
        if (data.length > 0) {
          this.recommendations.set(data);
        } else {
          this.getLatestListings().subscribe({
            next: (listings) => this.recommendations.set(listings),
          });
        }
        this.loadingRecommendations.set(false);
      },
      error: () => {
        this.getLatestListings().subscribe({
          next: (listings) => this.recommendations.set(listings),
          error: () => {},
        });
        this.loadingRecommendations.set(false);
      },
    });
  }

  /** Shared cached call for latest listings — used as fallback by multiple sections */
  private latestListings$: Observable<Listing[]> | null = null;
  private getLatestListings(): Observable<Listing[]> {
    if (!this.latestListings$) {
      this.latestListings$ = this.listingsService.getByCategory('', 1, 20).pipe(
        map((res) => res.data ?? []),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.latestListings$;
  }

  private loadNearby(): void {
    // Use selected location from localStorage
    try {
      const locRaw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== DEFAULT_COUNTRY) {
          if (loc.city?.name) this.userCity.set(loc.city.name);
          this.listingsService
            .getNearby({
              provinceId: loc.province?._id,
              cityId: loc.city?._id,
              areaId: loc.area?._id,
              limit: NEARBY_LISTINGS_LIMIT,
            })
            .subscribe({
              next: (res: ListingsResponse) => {
                const data = Array.isArray(res?.data) ? res.data : [];
                this.nearbyListings.set(data);
                this.loadingNearby.set(false);
                if (!this.userCity() && data.length > 0 && data[0].location?.city) {
                  this.userCity.set(data[0].location.city);
                }
              },
              error: () => this.loadLatestListings(),
            });
          return;
        }
      }
    } catch {}

    // No location selected — show latest listings
    this.loadLatestListings();
  }

  private loadLatestListings(): void {
    this.getLatestListings().subscribe({
      next: (listings) => {
        this.nearbyListings.set(listings.slice(0, 12));
        this.loadingNearby.set(false);
      },
      error: () => this.loadingNearby.set(false),
    });
  }
}
