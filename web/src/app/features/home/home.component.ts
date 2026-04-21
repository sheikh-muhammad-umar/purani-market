import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CategoriesService } from '../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../core/services/listings.service';
import { RecommendationsService } from '../../core/services/recommendations.service';
import { AuthService } from '../../core/auth/auth.service';
import { PriceFormatPipe } from '../../shared/pipes/price-format.pipe';
import { TruncateTextPipe } from '../../shared/pipes/truncate-text.pipe';
import { ListingUrlPipe } from '../../shared/pipes/listing-url.pipe';
import { CategoryModalComponent } from '../../shared/components/category-modal/category-modal.component';
import { Category, Listing } from '../../core/models';

interface CategoryChip {
  id: string;
  name: string;
  icon: string;
  slug: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  cars: '🚗',
  vehicles: '🚗',
  automobiles: '🚗',
  phones: '📱',
  mobiles: '📱',
  'mobile phones': '📱',
  electronics: '📱',
  property: '🏠',
  'real estate': '🏠',
  houses: '🏠',
  fashion: '👗',
  clothing: '👗',
  apparel: '👗',
  furniture: '🪑',
  'home & garden': '🪑',
  jobs: '💼',
  services: '🔧',
  kids: '🧸',
  'kids & baby': '🧸',
  sports: '⚽',
  'sports & hobbies': '⚽',
  animals: '🐾',
  pets: '🐾',
  books: '📚',
  education: '📚',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PriceFormatPipe,
    TruncateTextPipe,
    CategoryModalComponent,
    ListingUrlPipe,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  readonly categories = signal<Category[]>([]);
  readonly featuredListings = signal<Listing[]>([]);
  readonly recommendations = signal<Listing[]>([]);
  readonly nearbyListings = signal<Listing[]>([]);
  readonly userCity = signal<string>('');

  readonly loadingCategories = signal(true);
  readonly loadingFeatured = signal(true);
  readonly loadingRecommendations = signal(true);
  readonly loadingNearby = signal(true);

  readonly selectedCategory = signal<Category | null>(null);

  readonly categoryChips = computed<CategoryChip[]>(() =>
    this.categories()
      .filter((c) => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c._id,
        name: c.name,
        icon: this.getCategoryIcon(c.slug, c.name),
        slug: c.slug,
      })),
  );

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly recommendationsService: RecommendationsService,
    public readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFeatured();
    this.loadRecommendations();
    this.loadNearby();
  }

  getCategoryIcon(slug: string, name: string): string {
    const key = slug.toLowerCase();
    if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
    const nameKey = name.toLowerCase();
    if (CATEGORY_ICONS[nameKey]) return CATEGORY_ICONS[nameKey];
    return '📦';
  }

  getListingImage(listing: Listing): string {
    return (
      listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png'
    );
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
      const locRaw = localStorage.getItem('selected_location');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== 'Pakistan') {
          city = loc.city?.name;
        }
      }
    } catch {}

    this.listingsService.getFeaturedFiltered({ city, limit: 10 }).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? (res as any) : [];
        if (data.length > 0) {
          this.featuredListings.set(data);
          this.loadingFeatured.set(false);
        } else {
          // Fallback: show latest listings as "featured"
          this.listingsService.getByCategory('', 1, 10).subscribe({
            next: (fallback: any) => {
              this.featuredListings.set(Array.isArray(fallback?.data) ? fallback.data : []);
              this.loadingFeatured.set(false);
            },
            error: () => this.loadingFeatured.set(false),
          });
        }
      },
      error: () => this.loadingFeatured.set(false),
    });
  }

  private loadRecommendations(): void {
    this.recommendationsService.getRecommendations(20).subscribe({
      next: (listings) => {
        const data = Array.isArray(listings) ? listings : [];
        if (data.length > 0) {
          this.recommendations.set(data);
          this.loadingRecommendations.set(false);
        } else {
          this.loadRandomListings();
        }
      },
      error: () => this.loadRandomListings(),
    });
  }

  private loadRandomListings(): void {
    // No activity history — show latest listings as recommendations
    this.listingsService.getByCategory('', 1, 20).subscribe({
      next: (res: any) => {
        this.recommendations.set(Array.isArray(res?.data) ? res.data : []);
        this.loadingRecommendations.set(false);
      },
      error: () => this.loadingRecommendations.set(false),
    });
  }

  private loadNearby(): void {
    // Use selected location from localStorage
    try {
      const locRaw = localStorage.getItem('selected_location');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc.label && loc.label !== 'Pakistan') {
          if (loc.city?.name) this.userCity.set(loc.city.name);
          this.listingsService
            .getNearby({
              provinceId: loc.province?._id,
              cityId: loc.city?._id,
              areaId: loc.area?._id,
              limit: 12,
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
    this.listingsService.getByCategory('', 1, 12).subscribe({
      next: (res: any) => {
        this.nearbyListings.set(Array.isArray(res?.data) ? res.data : []);
        this.loadingNearby.set(false);
      },
      error: () => this.loadingNearby.set(false),
    });
  }
}
