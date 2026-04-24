import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, CreateListingPayload } from '../../../core/services/listings.service';
import { LocationService } from '../../../core/services/location.service';
import { BrandsService } from '../../../core/services/brands.service';
import { Category, CategoryAttribute, Listing, Province, City, Area } from '../../../core/models';
import {
  VehicleModel,
  VehicleVariant,
  BrandOption,
  OTHER_OPTION_ID,
} from '../../../core/models/brand.model';
import { extractIdFromSlug, listingSlug } from '../../../core/utils/slug';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { DEFAULT_CURRENCY } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { saveState, loadState, clearState } from '../../../core/utils/state-persistence';
import { ListingCondition } from '../../../core/constants';
import { CONDITION_OPTIONS } from '../../../core/constants/select-options';
import { mapLinkValidator } from '../../../core/utils/map-link';

@Component({
  selector: 'app-edit-listing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-listing.component.html',
  styleUrls: ['../create-listing/create-listing.component.scss'],
})
export class EditListingComponent implements OnInit, OnDestroy {
  readonly conditionOptions = CONDITION_OPTIONS;
  readonly ERROR_MSG = ERROR_MSG;
  readonly OTHER_ID = OTHER_OPTION_ID;
  private readonly DRAFT_KEY = 'edit-listing-step';
  private readonly destroy$ = new Subject<void>();

  listingId = '';
  listing = signal<Listing | null>(null);
  loading = signal(true);

  currentStep = signal(1);
  totalSteps = 5;
  stepLabels = ['Category', 'Details', 'Media', 'Location', 'Review'];

  allCategories = signal<Category[]>([]);
  level1Categories = computed(() =>
    this.allCategories().filter((c) => c.level === 1 && c.isActive),
  );
  level2Categories = signal<Category[]>([]);
  level3Categories = signal<Category[]>([]);
  selectedLevel1 = signal<Category | null>(null);
  selectedLevel2 = signal<Category | null>(null);
  selectedLevel3 = signal<Category | null>(null);
  selectedCategory = computed(
    () => this.selectedLevel3() ?? this.selectedLevel2() ?? this.selectedLevel1(),
  );
  categoryAttributes = signal<CategoryAttribute[]>([]);
  categoryFeatures = signal<string[]>([]);
  selectedFeatures = signal<string[]>([]);

  // Brand / Model / Variant state
  hasBrands = signal(false);
  isVehicleCategory = signal(false);
  availableBrands = signal<BrandOption[]>([]);
  availableModels = signal<VehicleModel[]>([]);
  availableVariants = signal<VehicleVariant[]>([]);
  selectedBrandId = signal<string>('');
  selectedBrandName = signal<string>('');
  otherBrandName = signal<string>('');
  selectedModelId = signal<string>('');
  selectedModelName = signal<string>('');
  otherModelName = signal<string>('');
  selectedVariantId = signal<string>('');
  selectedVariantName = signal<string>('');
  otherVariantName = signal<string>('');
  brandSearch = signal<string>('');
  modelSearch = signal<string>('');
  variantSearch = signal<string>('');
  filteredBrands = computed(() => {
    const q = this.brandSearch().toLowerCase().trim();
    const all = this.availableBrands();
    return q ? all.filter((b) => b.name.toLowerCase().includes(q)) : all;
  });
  filteredModels = computed(() => {
    const q = this.modelSearch().toLowerCase().trim();
    const all = this.availableModels();
    return q ? all.filter((m) => m.name.toLowerCase().includes(q)) : all;
  });
  filteredVariants = computed(() => {
    const q = this.variantSearch().toLowerCase().trim();
    const all = this.availableVariants();
    return q ? all.filter((v) => v.name.toLowerCase().includes(q)) : all;
  });

  detailsForm!: FormGroup;
  locationForm!: FormGroup;
  featureAd = signal(false);
  submitting = signal(false);
  error = signal('');

  // Custom dropdown state
  openDropdown = signal<string | null>(null);

  // Location state
  provinces = signal<Province[]>([]);
  citiesForListing = signal<City[]>([]);
  areasForListing = signal<Area[]>([]);
  selectedProvince = signal<Province | null>(null);
  selectedCityObj = signal<City | null>(null);
  selectedAreaObj = signal<Area | null>(null);
  selectedBlockPhase = signal<string | null>(null);
  citySearch = signal('');
  areaSearch = signal('');
  blockPhaseSearch = signal('');

  filteredCities = computed(() => {
    const q = this.citySearch().toLowerCase().trim();
    const all = this.citiesForListing();
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  filteredAreas = computed(() => {
    const q = this.areaSearch().toLowerCase().trim();
    const all = this.areasForListing();
    return q ? all.filter((a) => a.name.toLowerCase().includes(q)) : all;
  });

  blockPhaseOptions = computed(() => this.selectedAreaObj()?.blockPhases ?? []);

  filteredBlockPhases = computed(() => {
    const q = this.blockPhaseSearch().toLowerCase().trim();
    const all = this.blockPhaseOptions();
    return q ? all.filter((bp) => bp.toLowerCase().includes(q)) : all;
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly locationService: LocationService,
    private readonly tracker: ActivityTrackerService,
    private readonly brandsService: BrandsService,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.detailsForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.required, Validators.maxLength(5000)]],
      price: [null, [Validators.required, Validators.min(1)]],
      condition: [ListingCondition.USED, Validators.required],
    });

    this.locationForm = this.fb.group({
      city: ['', Validators.required],
      area: [''],
      blockPhase: [''],
      mapLink: ['', mapLinkValidator()],
    });

    this.listingId = extractIdFromSlug(this.route.snapshot.paramMap.get('id') ?? '');

    this.locationService
      .getProvinces()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (provinces) => {
          this.provinces.set(provinces);
          this.categoriesService
            .getAll()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (cats) => {
                this.allCategories.set(cats);
                this.loadListing();
              },
              error: () => {
                this.allCategories.set([]);
                this.loadListing();
              },
            });
        },
        error: () => {
          this.categoriesService
            .getAll()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (cats) => {
                this.allCategories.set(cats);
                this.loadListing();
              },
              error: () => {
                this.allCategories.set([]);
                this.loadListing();
              },
            });
        },
      });
  }

  private loadListing(): void {
    if (!this.listingId) {
      this.loading.set(false);
      return;
    }

    this.listingsService
      .getById(this.listingId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (listing) => {
          this.listing.set(listing);
          this.populateForm(listing);
          this.loading.set(false);
          const saved = loadState<{ step: number }>(this.DRAFT_KEY);
          if (saved.step && saved.step > 1) this.currentStep.set(saved.step);
        },
        error: () => {
          this.error.set(ERROR_MSG.LISTING_LOAD_FAILED);
          this.loading.set(false);
        },
      });
  }

  private populateForm(listing: Listing): void {
    this.detailsForm.patchValue({
      title: listing.title,
      description: listing.description,
      price: listing.price.amount,
      condition: listing.condition,
    });

    this.featureAd.set(listing.isFeatured);
    this.selectedFeatures.set(listing.selectedFeatures || []);

    // Restore category selection
    if (listing.categoryPath?.length > 0) {
      const cats = this.allCategories();
      const l1 = cats.find((c) => c._id === listing.categoryPath[0]);
      if (l1) {
        this.selectLevel1(l1);
        if (listing.categoryPath.length > 1) {
          const l2 = cats.find((c) => c._id === listing.categoryPath[1]);
          if (l2) {
            this.selectLevel2(l2);
            if (listing.categoryPath.length > 2) {
              const l3 = cats.find((c) => c._id === listing.categoryPath[2]);
              if (l3) this.selectLevel3(l3);
            }
          }
        }
      }
    }

    // Populate dynamic attributes
    if (listing.categoryAttributes) {
      for (const [key, value] of Object.entries(listing.categoryAttributes)) {
        this.getDynamicControl(key).setValue(value);
      }
    }

    // Restore brand/model/variant
    this.restoreBrandSelection(listing);

    // Restore location selections from IDs
    this.restoreLocation(listing);
  }

  private restoreBrandSelection(listing: Listing): void {
    // Wait for brands to load, then restore selection
    // Use a small delay to let loadBrandsForCategory complete
    setTimeout(() => {
      if (this.isVehicleCategory()) {
        if (listing.vehicleBrandId) {
          this.selectedBrandId.set(listing.vehicleBrandId);
          this.selectedBrandName.set(listing.vehicleBrandName || '');
          // Load models for this brand
          this.brandsService
            .getModelsByBrand(listing.vehicleBrandId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (models) => {
                this.availableModels.set(models);
                if (listing.modelId) {
                  this.selectedModelId.set(listing.modelId);
                  this.selectedModelName.set(listing.modelName || '');
                  // Load variants for this model
                  this.brandsService
                    .getVariantsByModel(listing.modelId)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                      next: (variants) => {
                        this.availableVariants.set(variants);
                        if (listing.variantId) {
                          this.selectedVariantId.set(listing.variantId);
                          this.selectedVariantName.set(listing.variantName || '');
                        }
                      },
                    });
                } else if (listing.modelName) {
                  this.selectedModelId.set(OTHER_OPTION_ID);
                  this.otherModelName.set(listing.modelName);
                }
              },
            });
        } else if (listing.vehicleBrandName) {
          this.selectedBrandId.set(OTHER_OPTION_ID);
          this.otherBrandName.set(listing.vehicleBrandName);
        }
      } else {
        if (listing.brandId) {
          this.selectedBrandId.set(listing.brandId);
          this.selectedBrandName.set(listing.brandName || '');
        } else if (listing.brandName) {
          this.selectedBrandId.set(OTHER_OPTION_ID);
          this.otherBrandName.set(listing.brandName);
        }
      }
    }, 300);
  }

  private restoreLocation(listing: Listing): void {
    const loc = listing.location;

    if (loc.provinceId) {
      const prov = this.provinces().find((p) => p._id === loc.provinceId);
      if (prov) {
        this.selectedProvince.set(prov);
        this.locationService
          .getCities(prov._id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (cities) => {
              this.citiesForListing.set(cities);
              if (loc.cityId) {
                const city = cities.find((c) => c._id === loc.cityId);
                if (city) {
                  this.selectedCityObj.set(city);
                  this.locationForm.patchValue({ city: city.name });
                  this.locationService
                    .getAreas(city._id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                      next: (areas) => {
                        this.areasForListing.set(areas);
                        if (loc.areaId) {
                          const area = areas.find((a: Area) => a._id === loc.areaId);
                          if (area) {
                            this.selectedAreaObj.set(area);
                            this.locationForm.patchValue({ area: area.name });
                            if (loc.blockPhase) {
                              this.selectedBlockPhase.set(loc.blockPhase);
                              this.locationForm.patchValue({ blockPhase: loc.blockPhase });
                            }
                          }
                        }
                      },
                    });
                }
              }
            },
          });
      }
    } else {
      // Fallback: set text values if no IDs
      this.locationForm.patchValue({
        city: loc.city || '',
        area: loc.area || '',
      });
    }
    // Restore mapLink regardless of ID-based or text-based restore
    if (loc.mapLink) {
      this.locationForm.patchValue({ mapLink: loc.mapLink });
    }
  }

  // --- Custom Dropdown ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-wrap')) {
      this.openDropdown.set(null);
    }
  }

  toggleDropdown(key: string): void {
    this.openDropdown.set(this.openDropdown() === key ? null : key);
  }

  // --- Location ---
  selectLocationProvince(province: Province): void {
    this.selectedProvince.set(province);
    this.selectedCityObj.set(null);
    this.selectedAreaObj.set(null);
    this.selectedBlockPhase.set(null);
    this.citiesForListing.set([]);
    this.areasForListing.set([]);
    this.citySearch.set('');
    this.areaSearch.set('');
    this.blockPhaseSearch.set('');
    this.locationForm.patchValue({ city: '', area: '', blockPhase: '' });
    this.locationService
      .getCities(province._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => this.citiesForListing.set(cities),
      });
  }

  selectLocationCity(city: City): void {
    this.selectedCityObj.set(city);
    this.selectedAreaObj.set(null);
    this.selectedBlockPhase.set(null);
    this.areasForListing.set([]);
    this.areaSearch.set('');
    this.blockPhaseSearch.set('');
    this.locationForm.patchValue({ city: city.name, area: '', blockPhase: '' });
    this.locationService
      .getAreas(city._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (areas) => this.areasForListing.set(areas),
      });
  }

  selectLocationArea(area: Area): void {
    this.selectedAreaObj.set(area);
    this.selectedBlockPhase.set(null);
    this.blockPhaseSearch.set('');
    this.locationForm.patchValue({ area: area.name, blockPhase: '' });
  }

  selectBlockPhase(value: string): void {
    this.selectedBlockPhase.set(value);
    this.locationForm.patchValue({ blockPhase: value });
  }

  // --- Category ---
  selectLevel1(cat: Category): void {
    this.selectedLevel1.set(cat);
    this.selectedLevel2.set(null);
    this.selectedLevel3.set(null);
    this.level3Categories.set([]);
    this.selectedFeatures.set([]);
    this.level2Categories.set(
      this.allCategories().filter((c) => c.parentId === cat._id && c.isActive),
    );
    this.loadInheritedAttributes(cat._id);
  }

  selectLevel2(cat: Category): void {
    this.selectedLevel2.set(cat);
    this.selectedLevel3.set(null);
    this.selectedFeatures.set([]);
    this.level3Categories.set(
      this.allCategories().filter((c) => c.parentId === cat._id && c.isActive),
    );
    this.loadInheritedAttributes(cat._id);
  }

  selectLevel3(cat: Category): void {
    this.selectedLevel3.set(cat);
    this.selectedFeatures.set([]);
    this.loadInheritedAttributes(cat._id);
  }

  toggleFeature(feature: string): void {
    this.selectedFeatures.update((features) =>
      features.includes(feature) ? features.filter((f) => f !== feature) : [...features, feature],
    );
  }

  getDynamicControl(key: string): FormControl {
    if (!this.detailsForm.contains(key)) {
      this.detailsForm.addControl(key, new FormControl(''));
    }
    return this.detailsForm.get(key) as FormControl;
  }

  private loadInheritedAttributes(categoryId: string): void {
    this.categoriesService
      .getInheritedAttributes(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ attributes, features }) => {
          this.categoryAttributes.set(attributes ?? []);
          this.categoryFeatures.set(features ?? []);
        },
        error: () => {
          this.categoryAttributes.set([]);
          this.categoryFeatures.set([]);
        },
      });
    this.loadBrandsForCategory();
  }

  private loadBrandsForCategory(): void {
    const cats = [this.selectedLevel1(), this.selectedLevel2(), this.selectedLevel3()].filter(
      Boolean,
    ) as Category[];
    const brandCat = cats.find((c) => c.hasBrands);
    if (!brandCat) {
      this.hasBrands.set(false);
      this.isVehicleCategory.set(false);
      return;
    }
    this.hasBrands.set(true);

    const checks$ = cats.map((c) =>
      this.brandsService.checkVehicleCategory(c._id).pipe(
        map((result) => ({ catId: c._id, hasVehicleBrands: result.hasVehicleBrands })),
        catchError(() => of({ catId: c._id, hasVehicleBrands: false })),
      ),
    );

    forkJoin(checks$)
      .pipe(takeUntil(this.destroy$))
      .subscribe((results) => {
        const vehicleMatch = results.find((r) => r.hasVehicleBrands);
        if (vehicleMatch) {
          this.isVehicleCategory.set(true);
          this.brandsService
            .getVehicleBrandsByCategory(vehicleMatch.catId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (brands) =>
                this.availableBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
              error: () => this.availableBrands.set([]),
            });
        } else {
          this.isVehicleCategory.set(false);
          this.brandsService
            .getByCategory(brandCat._id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (brands) =>
                this.availableBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
              error: () => this.availableBrands.set([]),
            });
        }
      });
  }

  selectBrand(id: string, name: string): void {
    this.selectedBrandId.set(id);
    this.selectedBrandName.set(name);
    this.otherBrandName.set('');
    this.selectedModelId.set('');
    this.selectedModelName.set('');
    this.otherModelName.set('');
    this.selectedVariantId.set('');
    this.selectedVariantName.set('');
    this.otherVariantName.set('');
    this.availableModels.set([]);
    this.availableVariants.set([]);
    this.openDropdown.set(null);
    this.brandSearch.set('');

    if (id !== OTHER_OPTION_ID && this.isVehicleCategory()) {
      this.brandsService
        .getModelsByBrand(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (models) => this.availableModels.set(models),
          error: () => this.availableModels.set([]),
        });
    }
  }

  selectModel(id: string, name: string): void {
    this.selectedModelId.set(id);
    this.selectedModelName.set(name);
    this.otherModelName.set('');
    this.selectedVariantId.set('');
    this.selectedVariantName.set('');
    this.otherVariantName.set('');
    this.availableVariants.set([]);
    this.openDropdown.set(null);
    this.modelSearch.set('');

    if (id !== OTHER_OPTION_ID) {
      this.brandsService
        .getVariantsByModel(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (variants) => this.availableVariants.set(variants),
          error: () => this.availableVariants.set([]),
        });
    }
  }

  selectVariant(id: string, name: string): void {
    this.selectedVariantId.set(id);
    this.selectedVariantName.set(name);
    this.otherVariantName.set('');
    this.openDropdown.set(null);
    this.variantSearch.set('');
  }

  isCategoryStepValid(): boolean {
    return this.selectedCategory() !== null;
  }

  isDetailsStepValid(): boolean {
    const base =
      this.detailsForm.get('title')!.valid &&
      this.detailsForm.get('description')!.valid &&
      this.detailsForm.get('price')!.valid &&
      this.detailsForm.get('condition')!.valid;
    if (!base) return false;
    for (const attr of this.categoryAttributes()) {
      if (attr.required && !this.detailsForm.get(attr.key)?.value) return false;
    }
    // Validate brand selection
    if (this.hasBrands()) {
      const brandId = this.selectedBrandId();
      if (!brandId) return false;
      if (brandId === OTHER_OPTION_ID && !this.otherBrandName().trim()) return false;
      if (this.isVehicleCategory()) {
        const modelId = this.selectedModelId();
        if (!modelId) return false;
        if (modelId === OTHER_OPTION_ID && !this.otherModelName().trim()) return false;
      }
    }
    return true;
  }

  isLocationStepValid(): boolean {
    return !!this.locationForm.get('city')?.value && this.locationForm.valid;
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return this.isCategoryStepValid();
      case 2:
        return this.isDetailsStepValid();
      case 3:
        return true;
      case 4:
        return this.isLocationStepValid();
      case 5:
        return true;
      default:
        return false;
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.isStepValid(this.currentStep())) {
      this.currentStep.update((s) => s + 1);
      saveState(this.DRAFT_KEY, { step: this.currentStep() });
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
      saveState(this.DRAFT_KEY, { step: this.currentStep() });
    }
  }

  goToStep(step: number): void {
    for (let i = 1; i < step; i++) {
      if (!this.isStepValid(i)) return;
    }
    this.currentStep.set(step);
  }

  getCategoryPath(): string {
    const parts: string[] = [];
    if (this.selectedLevel1()) parts.push(this.selectedLevel1()!.name);
    if (this.selectedLevel2()) parts.push(this.selectedLevel2()!.name);
    if (this.selectedLevel3()) parts.push(this.selectedLevel3()!.name);
    return parts.join(' → ');
  }

  buildCategoryPathIds(): string[] {
    const ids: string[] = [];
    if (this.selectedLevel1()) ids.push(this.selectedLevel1()!._id);
    if (this.selectedLevel2()) ids.push(this.selectedLevel2()!._id);
    if (this.selectedLevel3()) ids.push(this.selectedLevel3()!._id);
    return ids;
  }

  toggleFeatureAd(): void {
    this.featureAd.update((v) => !v);
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');

    const cat = this.selectedCategory()!;
    const details = this.detailsForm.value;
    const loc = this.locationForm.value;

    const catAttrs: Record<string, unknown> = {};
    for (const attr of this.categoryAttributes()) {
      catAttrs[attr.key] = details[attr.key];
    }

    const payload: Partial<CreateListingPayload> = {
      title: details.title,
      description: details.description,
      price: { amount: details.price, currency: DEFAULT_CURRENCY },
      categoryId: cat._id,
      categoryPath: this.buildCategoryPathIds(),
      condition: details.condition,
      categoryAttributes: catAttrs,
      selectedFeatures: this.selectedFeatures(),
      location: {
        provinceId: this.selectedProvince()?._id || undefined,
        cityId: this.selectedCityObj()?._id || undefined,
        areaId: this.selectedAreaObj()?._id || undefined,
        city: loc.city,
        area: loc.area || undefined,
        blockPhase: loc.blockPhase || undefined,
        mapLink: loc.mapLink?.trim() || undefined,
      },
    };

    // Add brand/model/variant fields
    if (this.hasBrands()) {
      const brandId = this.selectedBrandId();
      if (this.isVehicleCategory()) {
        payload.vehicleBrandId = brandId;
        payload.vehicleBrandName =
          brandId === OTHER_OPTION_ID ? this.otherBrandName().trim() : this.selectedBrandName();
        const modelId = this.selectedModelId();
        payload.modelId = modelId;
        payload.modelName =
          modelId === OTHER_OPTION_ID ? this.otherModelName().trim() : this.selectedModelName();
        const variantId = this.selectedVariantId();
        if (variantId) {
          payload.variantId = variantId;
          payload.variantName =
            variantId === OTHER_OPTION_ID
              ? this.otherVariantName().trim()
              : this.selectedVariantName();
        }
      } else {
        payload.brandId = brandId;
        payload.brandName =
          brandId === OTHER_OPTION_ID ? this.otherBrandName().trim() : this.selectedBrandName();
      }
    }

    this.listingsService
      .update(this.listingId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          clearState(this.DRAFT_KEY);
          const original = this.listing();
          const changes: Record<string, { from: unknown; to: unknown }> = {};
          if (original?.title !== details.title)
            changes['title'] = { from: original?.title, to: details.title };
          if (original?.price?.amount !== details.price)
            changes['price'] = { from: original?.price?.amount, to: details.price };
          if (original?.condition !== details.condition)
            changes['condition'] = { from: original?.condition, to: details.condition };
          if (original?.location?.city !== loc.city)
            changes['city'] = { from: original?.location?.city, to: loc.city };
          this.tracker.track(TrackingEvent.LISTING_EDIT, {
            productListingId: this.listingId,
            metadata: { title: details.title, changes },
          });
          if (original?.price?.amount !== details.price) {
            this.tracker.track(TrackingEvent.LISTING_PRICE_CHANGE, {
              productListingId: this.listingId,
              categoryId: cat._id,
              metadata: {
                title: details.title,
                categoryName: cat.name,
                condition: details.condition,
                previousPrice: original?.price?.amount,
                newPrice: details.price,
                priceDiff: details.price - (original?.price?.amount ?? 0),
                city: loc.city,
              },
            });
          }
          const title = this.detailsForm.get('title')?.value ?? '';
          this.router.navigate([ROUTES.LISTINGS, listingSlug({ _id: this.listingId, title })]);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message ?? ERROR_MSG.LISTING_UPDATE_FAILED);
        },
      });
  }
}
