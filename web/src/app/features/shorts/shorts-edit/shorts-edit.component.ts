import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { NumberToWordsPipe } from '../../../shared/pipes/number-to-words.pipe';
import { ShortsService, ShortVideo } from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { ListingsService } from '../../../core/services/listings.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { ROUTES } from '../../../core/constants/routes';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { Category, Province, City, Area, Listing } from '../../../core/models';

@Component({
  selector: 'app-shorts-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomSelectComponent, NumberToWordsPipe],
  templateUrl: './shorts-edit.component.html',
  styleUrl: './shorts-edit.component.scss',
})
export class ShortsEditComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly short = signal<ShortVideo | null>(null);

  readonly categories = signal<Category[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly cities = signal<City[]>([]);
  readonly areas = signal<Area[]>([]);

  // Category multi-level
  readonly selectedLevel1Id = signal<string>('');
  readonly selectedLevel2Id = signal<string>('');
  readonly selectedLevel3Id = signal<string>('');

  readonly level1Options = computed<SelectOption[]>(() =>
    this.categories()
      .filter((c) => c.level === 1 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ value: c._id, label: c.name })),
  );

  readonly level2Options = computed<SelectOption[]>(() => {
    const parentId = this.selectedLevel1Id();
    if (!parentId) return [];
    return this.categories()
      .filter((c) => c.parentId === parentId && c.level === 2 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ value: c._id, label: c.name }));
  });

  readonly level3Options = computed<SelectOption[]>(() => {
    const parentId = this.selectedLevel2Id();
    if (!parentId) return [];
    return this.categories()
      .filter((c) => c.parentId === parentId && c.level === 3 && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ value: c._id, label: c.name }));
  });

  readonly selectedCategoryPath = computed(() => {
    const parts: string[] = [];
    const l1 = this.categories().find((c) => c._id === this.selectedLevel1Id());
    if (l1) parts.push(l1.name);
    const l2 = this.categories().find((c) => c._id === this.selectedLevel2Id());
    if (l2) parts.push(l2.name);
    const l3 = this.categories().find((c) => c._id === this.selectedLevel3Id());
    if (l3) parts.push(l3.name);
    return parts.join(' → ');
  });

  // Location multi-level
  readonly selectedProvinceId = signal<string>('');
  readonly selectedCityId = signal<string>('');
  readonly selectedAreaId = signal<string>('');

  readonly provinceOptions = computed<SelectOption[]>(() =>
    this.provinces().map((p) => ({ value: p._id, label: p.name })),
  );

  readonly cityOptionsForProvince = computed<SelectOption[]>(() =>
    this.cities().map((c) => ({ value: c._id, label: c.name })),
  );

  readonly areaOptionsForCity = computed<SelectOption[]>(() =>
    this.areas().map((a) => ({ value: a._id, label: a.name })),
  );

  readonly myListings = signal<Listing[]>([]);
  readonly myListingOptions = computed<SelectOption[]>(() =>
    this.myListings().map((l) => ({ value: l._id, label: l.title })),
  );

  title = '';
  description = '';
  price: number | null = null;
  selectedCategoryId = '';
  selectedListingId = '';

  private shortId = '';

  constructor(
    private readonly shortsService: ShortsService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
    private readonly listingsService: ListingsService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    this.shortId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.shortId) {
      this.router.navigate([ROUTES.LISTINGS_MY], { queryParams: { tab: 'shorts' } });
      return;
    }
    this.loadCategories();
    this.loadProvinces();
    this.loadMyListings();
    this.loadShort();
  }

  private loadShort(): void {
    this.shortsService.getShortById(this.shortId).subscribe({
      next: (short) => {
        this.short.set(short);
        this.prefillForm(short);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(ERROR_MSG.SHORT_LOAD_FAILED);
        this.loading.set(false);
      },
    });
  }

  private prefillForm(short: ShortVideo): void {
    this.title = short.title || '';
    this.description = short.description || '';
    this.price = short.price ?? null;
    this.selectedListingId = short.linkedListingId?._id || short.linkedListingId || '';

    // Category
    const catId = typeof short.categoryId === 'object' ? short.categoryId?._id : short.categoryId;
    if (catId) {
      this.selectedCategoryId = catId;
      // Resolve category hierarchy once categories are loaded
      this.resolveCategoryHierarchy(catId);
    }

    // Location
    if (short.location) {
      if (short.location.provinceId) {
        this.selectedProvinceId.set(short.location.provinceId);
        this.locationService.getCities(short.location.provinceId).subscribe({
          next: (cities) => {
            this.cities.set(cities);
            if (short.location?.cityId) {
              this.selectedCityId.set(short.location.cityId);
              this.locationService.getAreas(short.location.cityId).subscribe({
                next: (areas) => {
                  this.areas.set(areas);
                  if (short.location?.areaId) {
                    this.selectedAreaId.set(short.location.areaId);
                  }
                },
              });
            }
          },
        });
      }
    }
  }

  private resolveCategoryHierarchy(catId: string): void {
    // Wait for categories to load, then resolve hierarchy
    const tryResolve = () => {
      const cats = this.categories();
      if (cats.length === 0) {
        setTimeout(tryResolve, 100);
        return;
      }

      const target = cats.find((c) => c._id === catId);
      if (!target) return;

      if (target.level === 3) {
        this.selectedLevel3Id.set(target._id);
        const parent2 = cats.find((c) => c._id === target.parentId);
        if (parent2) {
          this.selectedLevel2Id.set(parent2._id);
          const parent1 = cats.find((c) => c._id === parent2.parentId);
          if (parent1) this.selectedLevel1Id.set(parent1._id);
        }
      } else if (target.level === 2) {
        this.selectedLevel2Id.set(target._id);
        const parent1 = cats.find((c) => c._id === target.parentId);
        if (parent1) this.selectedLevel1Id.set(parent1._id);
      } else if (target.level === 1) {
        this.selectedLevel1Id.set(target._id);
      }
    };
    tryResolve();
  }

  private loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => this.categories.set(Array.isArray(cats) ? cats : []),
    });
  }

  private loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces) => this.provinces.set(provinces),
    });
  }

  private loadMyListings(): void {
    this.listingsService.getMyListings(1, 50).subscribe({
      next: (res) => this.myListings.set(res.data ?? []),
    });
  }

  // Category handlers
  onLevel1Change(id: string): void {
    this.selectedLevel1Id.set(id);
    this.selectedLevel2Id.set('');
    this.selectedLevel3Id.set('');
    this.selectedCategoryId = id;
  }

  onLevel2Change(id: string): void {
    this.selectedLevel2Id.set(id);
    this.selectedLevel3Id.set('');
    this.selectedCategoryId = id;
  }

  onLevel3Change(id: string): void {
    this.selectedLevel3Id.set(id);
    this.selectedCategoryId = id;
  }

  // Location handlers
  onProvinceChange(id: string): void {
    this.selectedProvinceId.set(id);
    this.selectedCityId.set('');
    this.selectedAreaId.set('');
    this.cities.set([]);
    this.areas.set([]);
    if (id) {
      this.locationService.getCities(id).subscribe({
        next: (cities) => this.cities.set(cities),
      });
    }
  }

  onCityChange(id: string): void {
    this.selectedCityId.set(id);
    this.selectedAreaId.set('');
    this.areas.set([]);
    if (id) {
      this.locationService.getAreas(id).subscribe({
        next: (areas) => this.areas.set(areas),
      });
    }
  }

  onAreaChange(id: string): void {
    this.selectedAreaId.set(id);
  }

  canSubmit(): boolean {
    return !!(
      !this.saving() &&
      this.title.trim() &&
      this.description.trim() &&
      this.price !== null &&
      this.price >= 0 &&
      this.selectedCategoryId &&
      this.selectedCityId()
    );
  }

  saveShort(): void {
    if (!this.canSubmit()) return;

    this.saving.set(true);
    this.error.set('');

    const data: Record<string, any> = {
      title: this.title,
      description: this.description,
      price: this.price,
      categoryId: this.selectedCategoryId,
    };

    // Category name
    const cat = this.categories().find((c) => c._id === this.selectedCategoryId);
    if (cat) {
      data['categoryName'] = cat.name;
    }

    // Location
    const location: Record<string, any> = {};
    if (this.selectedProvinceId()) {
      location['provinceId'] = this.selectedProvinceId();
      const province = this.provinces().find((p) => p._id === this.selectedProvinceId());
      if (province) location['province'] = province.name;
    }
    if (this.selectedCityId()) {
      location['cityId'] = this.selectedCityId();
      const city = this.cities().find((c) => c._id === this.selectedCityId());
      if (city) location['city'] = city.name;
    }
    if (this.selectedAreaId()) {
      location['areaId'] = this.selectedAreaId();
      const area = this.areas().find((a) => a._id === this.selectedAreaId());
      if (area) location['area'] = area.name;
    }
    data['location'] = location;

    // Linked listing
    if (this.selectedListingId) {
      data['linkedListingId'] = this.selectedListingId;
    }

    this.shortsService.updateShort(this.shortId, data).subscribe({
      next: () => {
        this.saving.set(false);
        this.tracker.track(TrackingEvent.SHORT_EDIT, {
          metadata: { shortId: this.shortId },
        });
        this.router.navigate([ROUTES.LISTINGS_MY], { queryParams: { tab: 'shorts' } });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(ERROR_MSG.SHORT_UPDATE_FAILED);
      },
    });
  }
}
