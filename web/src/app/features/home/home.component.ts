import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CategoriesService } from '../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../core/services/listings.service';
import { RecommendationsService } from '../../core/services/recommendations.service';
import { AuthService } from '../../core/auth/auth.service';
import { PriceFormatPipe } from '../../shared/pipes/price-format.pipe';
import { TruncateTextPipe } from '../../shared/pipes/truncate-text.pipe';
import { CategoryModalComponent } from '../../shared/components/category-modal/category-modal.component';
import { Category, Listing } from '../../core/models';

interface CategoryChip {
  id: string;
  name: string;
  icon: string;
  slug: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  cars: '🚗', vehicles: '🚗', automobiles: '🚗',
  phones: '📱', mobiles: '📱', 'mobile phones': '📱', electronics: '📱',
  property: '🏠', 'real estate': '🏠', houses: '🏠',
  fashion: '👗', clothing: '👗', apparel: '👗',
  furniture: '🪑', 'home & garden': '🪑',
  jobs: '💼', services: '🔧',
  kids: '🧸', 'kids & baby': '🧸',
  sports: '⚽', 'sports & hobbies': '⚽',
  animals: '🐾', pets: '🐾',
  books: '📚', education: '📚',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PriceFormatPipe, TruncateTextPipe, CategoryModalComponent],
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
      .filter(c => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => ({
        id: c._id,
        name: c.name,
        icon: this.getCategoryIcon(c.slug, c.name),
        slug: c.slug,
      }))
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
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || 'assets/placeholder.png';
  }

  openCategoryModal(chip: CategoryChip): void {
    const cat = this.categories().find(c => c._id === chip.id);
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
    this.listingsService.getFeatured(10).subscribe({
      next: (res: ListingsResponse) => {
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res as any : [];
        this.featuredListings.set(data);
        this.loadingFeatured.set(false);
      },
      error: () => this.loadingFeatured.set(false),
    });
  }

  private loadRecommendations(): void {
    this.recommendationsService.getRecommendations(20).subscribe({
      next: (listings) => {
        this.recommendations.set(Array.isArray(listings) ? listings : []);
        this.loadingRecommendations.set(false);
      },
      error: () => this.loadingRecommendations.set(false),
    });
  }

  private loadNearby(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.listingsService.getNearby(pos.coords.latitude, pos.coords.longitude).subscribe({
            next: (res: ListingsResponse) => {
              const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res as any : [];
              this.nearbyListings.set(data);
              if (data.length > 0 && data[0].location?.city) {
                this.userCity.set(data[0].location.city);
              }
              this.loadingNearby.set(false);
            },
            error: () => this.loadingNearby.set(false),
          });
        },
        () => {
          // Geolocation denied or unavailable — load without coords
          this.loadingNearby.set(false);
        },
      );
    } else {
      this.loadingNearby.set(false);
    }
  }
}
