import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, CreateListingPayload } from '../../../core/services/listings.service';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { BrandsService } from '../../../core/services/brands.service';
import { Category, CategoryAttribute, Province, City, Area } from '../../../core/models';
import {
  VehicleModel,
  VehicleVariant,
  BrandOption,
  OTHER_OPTION_ID,
} from '../../../core/models/brand.model';
import { ListingCondition, PackageType, PaymentStatus } from '../../../core/constants/enums';
import { CONDITION_OPTIONS } from '../../../core/constants/select-options';
import { listingSlug } from '../../../core/utils/slug';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { DEFAULT_CURRENCY } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { saveState, loadState, clearState } from '../../../core/utils/state-persistence';
import { computeFileHash } from '../../../core/utils/file-hash';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { mapLinkValidator } from '../../../core/utils/map-link';
import { AvailablePackagesComponent } from './available-packages/available-packages.component';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface MediaItem {
  file: File;
  preview: string;
  type: 'image' | 'video';
  hash?: string;
}

@Component({
  selector: 'app-create-listing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AvailablePackagesComponent],
  templateUrl: './create-listing.component.html',
  styleUrls: ['./create-listing.component.scss'],
})
export class CreateListingComponent implements OnInit, OnDestroy {
  readonly conditionOptions = CONDITION_OPTIONS;
  readonly ROUTES = ROUTES;
  readonly ERROR_MSG = ERROR_MSG;
  readonly OTHER_ID = OTHER_OPTION_ID;

  // Phone verification state
  phoneVerified = signal(false);
  phoneCheckLoading = signal(true);
  phoneStep = signal<'add' | 'verify'>('add');
  phoneForm!: FormGroup;
  otpForm!: FormGroup;
  phoneSending = signal(false);
  phoneError = signal('');
  phoneSuccess = signal('');
  pendingPhone = signal('');

  currentStep = signal(1);
  totalSteps = 5;
  stepLabels = ['Category', 'Details', 'Media', 'Location', 'Review'];

  // Category state
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

  // Media state
  mediaItems = signal<MediaItem[]>([]);
  videoItem = signal<MediaItem | null>(null);
  dragOver = signal(false);

  // Forms
  detailsForm!: FormGroup;
  locationForm!: FormGroup;
  featureAd = signal(false);
  featuredSlotsRemaining = signal(0);

  // Custom dropdown state
  openDropdown = signal<string | null>(null);

  // Year options for year-type attributes (current year down to 1970)
  getYearOptions(attr: { rangeMin?: number; rangeMax?: number }): number[] {
    const max = attr.rangeMax ?? new Date().getFullYear();
    const min = attr.rangeMin ?? 1970;
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }

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
  blockPhaseOptions = computed<string[]>(() => {
    const area = this.selectedAreaObj();
    if (!area) return [];
    return [...(area.subareas || []), ...(area.blockPhases || [])];
  });
  filteredBlockPhases = computed(() => {
    const q = this.blockPhaseSearch().toLowerCase().trim();
    const all = this.blockPhaseOptions();
    return q ? all.filter((b) => b.toLowerCase().includes(q)) : all;
  });

  // Submission
  submitting = signal(false);
  error = signal('');
  draftMediaWarning = signal(false);

  // Package selection
  selectedPurchaseId = signal<string>('');
  packageCategoryId = signal<string | null>(null);

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly packagesService: PackagesService,
    private readonly authService: AuthService,
    private readonly locationService: LocationService,
    private readonly tracker: ActivityTrackerService,
    private readonly brandsService: BrandsService,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    for (const item of this.mediaItems()) {
      URL.revokeObjectURL(item.preview);
    }
    const video = this.videoItem();
    if (video) URL.revokeObjectURL(video.preview);
  }

  private readonly DRAFT_KEY = 'create-listing-draft';

  private saveDraft(): void {
    const draft: Record<string, any> = {
      currentStep: this.currentStep(),
      selectedLevel1Id: this.selectedLevel1()?._id,
      selectedLevel2Id: this.selectedLevel2()?._id,
      selectedLevel3Id: this.selectedLevel3()?._id,
      selectedFeatures: this.selectedFeatures(),
      detailsForm: this.detailsForm?.value,
      locationForm: this.locationForm?.value,
      featureAd: this.featureAd(),
      selectedProvinceId: this.selectedProvince()?._id,
      selectedCityId: this.selectedCityObj()?._id,
      selectedAreaId: this.selectedAreaObj()?._id,
      selectedBlockPhase: this.selectedBlockPhase(),
    };
    // Include dynamic attribute values
    for (const attr of this.categoryAttributes()) {
      draft[`attr_${attr.key}`] = this.detailsForm?.get(attr.key)?.value;
    }
    saveState(this.DRAFT_KEY, draft);
  }

  private restoreDraft(): void {
    const draft = loadState<Record<string, any>>(this.DRAFT_KEY);
    if (!draft['currentStep']) return;

    const cats = this.allCategories();
    if (cats.length === 0) return;

    // Restore categories
    if (draft['selectedLevel1Id']) {
      const l1 = cats.find((c) => c._id === draft['selectedLevel1Id']);
      if (l1) {
        this.selectLevel1(l1);
        if (draft['selectedLevel2Id']) {
          const l2 = cats.find((c) => c._id === draft['selectedLevel2Id']);
          if (l2) {
            this.selectLevel2(l2);
            if (draft['selectedLevel3Id']) {
              const l3 = cats.find((c) => c._id === draft['selectedLevel3Id']);
              if (l3) this.selectLevel3(l3);
            }
          }
        }
      }
    }

    // Restore features
    if (draft['selectedFeatures']) this.selectedFeatures.set(draft['selectedFeatures']);

    // Restore details form
    if (draft['detailsForm']) {
      this.detailsForm.patchValue(draft['detailsForm']);
      // Restore dynamic attributes
      for (const attr of this.categoryAttributes()) {
        const val = draft[`attr_${attr.key}`];
        if (val !== undefined) this.getDynamicControl(attr.key).setValue(val);
      }
    }

    // Restore location form
    if (draft['locationForm']) this.locationForm.patchValue(draft['locationForm']);

    // Restore location selections
    if (draft['selectedProvinceId']) {
      const prov = this.provinces().find((p) => p._id === draft['selectedProvinceId']);
      if (prov) {
        this.selectedProvince.set(prov);
        this.locationService
          .getCities(prov._id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (cities) => {
              this.citiesForListing.set(cities);
              if (draft['selectedCityId']) {
                const city = cities.find((c: any) => c._id === draft['selectedCityId']);
                if (city) {
                  this.selectedCityObj.set(city);
                  this.locationService
                    .getAreas(city._id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                      next: (areas) => {
                        this.areasForListing.set(areas);
                        if (draft['selectedAreaId']) {
                          const area = areas.find((a: any) => a._id === draft['selectedAreaId']);
                          if (area) this.selectedAreaObj.set(area);
                        }
                      },
                    });
                }
              }
            },
          });
      }
    }
    if (draft['selectedBlockPhase']) this.selectedBlockPhase.set(draft['selectedBlockPhase']);
    if (draft['featureAd']) this.featureAd.set(draft['featureAd']);

    // Restore step — but cap at media step if media was lost on refresh
    const savedStep = draft['currentStep'] as number;
    if (savedStep > 3 && this.mediaItems().length === 0) {
      this.currentStep.set(3);
      this.draftMediaWarning.set(true);
    } else {
      this.currentStep.set(savedStep);
    }
  }

  clearDraft(): void {
    clearState(this.DRAFT_KEY);
  }

  ngOnInit(): void {
    this.phoneForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^0[0-9]{10}$/)]],
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

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

    // Check if user has a verified phone
    this.authService
      .fetchCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          if (user.phone && user.phoneVerified) {
            this.phoneVerified.set(true);
            this.loadFeaturedSlots();
          } else if (user.phone && !user.phoneVerified) {
            // Has phone but not verified — go straight to OTP step
            this.pendingPhone.set(user.phone);
            this.phoneStep.set('verify');
          }
          this.phoneCheckLoading.set(false);
        },
        error: () => this.phoneCheckLoading.set(false),
      });

    this.categoriesService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cats) => {
          this.allCategories.set(cats);
          this.restoreDraft();
        },
        error: () => this.allCategories.set([]),
      });

    this.locationService
      .getProvinces()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (provinces) => this.provinces.set(provinces),
        error: () => {},
      });
  }

  // --- Phone Verification ---
  submitPhone(): void {
    if (this.phoneForm.invalid || this.phoneSending()) return;
    this.phoneSending.set(true);
    this.phoneError.set('');
    const phone = this.phoneForm.get('phone')!.value;

    this.authService
      .addPhone(phone)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.phoneSending.set(false);
          this.pendingPhone.set(phone);
          this.phoneStep.set('verify');
          this.phoneSuccess.set('OTP sent to ' + phone);
        },
        error: (err) => {
          this.phoneSending.set(false);
          this.phoneError.set(err?.error?.message ?? 'Failed to send OTP. Please try again.');
        },
      });
  }

  submitOtp(): void {
    if (this.otpForm.invalid || this.phoneSending()) return;
    this.phoneSending.set(true);
    this.phoneError.set('');
    const otp = this.otpForm.get('otp')!.value;
    const phone = this.pendingPhone();

    // If user already had a phone (just not verified), use verifyPhone
    // If user added a new phone via change-phone, use verifyPhoneChange
    const verify$ =
      phone === this.authService.user()?.phone
        ? this.authService.verifyPhone(phone, otp)
        : this.authService.verifyPhoneChange(otp);

    verify$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.phoneSending.set(false);
        this.phoneVerified.set(true);
        this.phoneSuccess.set('Phone verified successfully!');
        this.loadFeaturedSlots();
        // Refresh user data
        this.authService.fetchCurrentUser().pipe(takeUntil(this.destroy$)).subscribe();
      },
      error: (err) => {
        this.phoneSending.set(false);
        this.phoneError.set(err?.error?.message ?? 'Invalid OTP. Please try again.');
      },
    });
  }

  resendOtp(): void {
    this.phoneSending.set(true);
    this.phoneError.set('');
    const phone = this.pendingPhone();

    const resend$ =
      phone === this.authService.user()?.phone
        ? this.authService.resendVerification(phone)
        : this.authService.addPhone(phone);

    resend$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.phoneSending.set(false);
        this.phoneSuccess.set('OTP resent to ' + phone);
      },
      error: (err) => {
        this.phoneSending.set(false);
        this.phoneError.set(err?.error?.message ?? 'Failed to resend OTP.');
      },
    });
  }

  private loadFeaturedSlots(): void {
    this.packagesService
      .getMyPurchases()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const purchases = Array.isArray(res) ? res : (res.data ?? []);
          const now = new Date();
          const remaining = purchases
            .filter(
              (p: any) =>
                p.type === PackageType.FEATURED_ADS &&
                p.paymentStatus === PaymentStatus.COMPLETED &&
                p.expiresAt &&
                new Date(p.expiresAt) > now,
            )
            .reduce((sum: number, p: any) => sum + (p.remainingQuantity || 0), 0);
          this.featuredSlotsRemaining.set(remaining);
        },
        error: () => this.featuredSlotsRemaining.set(0),
      });
  }

  // --- Category Step ---
  selectLevel1(cat: Category): void {
    this.selectedLevel1.set(cat);
    this.selectedLevel2.set(null);
    this.selectedLevel3.set(null);
    this.level3Categories.set([]);
    this.selectedFeatures.set([]);
    this.selectedPurchaseId.set('');
    this.packageCategoryId.set(cat._id);
    const children = this.allCategories().filter((c) => c.parentId === cat._id && c.isActive);
    this.level2Categories.set(children);
    this.loadInheritedAttributes(cat._id);
    this.saveDraft();
  }

  selectLevel2(cat: Category): void {
    this.selectedLevel2.set(cat);
    this.selectedLevel3.set(null);
    this.selectedFeatures.set([]);
    this.selectedPurchaseId.set('');
    this.packageCategoryId.set(cat._id);
    const children = this.allCategories().filter((c) => c.parentId === cat._id && c.isActive);
    this.level3Categories.set(children);
    this.loadInheritedAttributes(cat._id);
    this.saveDraft();
  }

  selectLevel3(cat: Category): void {
    this.selectedLevel3.set(cat);
    this.selectedFeatures.set([]);
    this.selectedPurchaseId.set('');
    this.packageCategoryId.set(cat._id);
    this.loadInheritedAttributes(cat._id);
    this.saveDraft();
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
    // Check if any selected category (or its ancestors) has hasBrands
    const cats = [this.selectedLevel1(), this.selectedLevel2(), this.selectedLevel3()].filter(
      Boolean,
    ) as Category[];
    const brandCat = cats.find((c) => c.hasBrands);
    if (!brandCat) {
      this.hasBrands.set(false);
      this.isVehicleCategory.set(false);
      this.resetBrandState();
      return;
    }
    this.hasBrands.set(true);
    this.resetBrandState();

    // Check all categories in the path for vehicle brands (data-driven, not slug-based)
    const catIds = cats.map((c) => c._id);
    this.checkVehicleBrandsForPath(catIds, brandCat);
  }

  private checkVehicleBrandsForPath(catIds: string[], brandCat: Category): void {
    const checks$ = catIds.map((catId) =>
      this.brandsService.checkVehicleCategory(catId).pipe(
        map((result) => ({ catId, hasVehicleBrands: result.hasVehicleBrands })),
        catchError(() => of({ catId, hasVehicleBrands: false })),
      ),
    );

    forkJoin(checks$)
      .pipe(takeUntil(this.destroy$))
      .subscribe((results) => {
        const vehicleMatch = results.find((r) => r.hasVehicleBrands);
        if (vehicleMatch) {
          this.isVehicleCategory.set(true);
          this.loadVehicleBrands(vehicleMatch.catId);
        } else {
          this.isVehicleCategory.set(false);
          this.loadSimpleBrands(brandCat._id);
        }
      });
  }

  private loadVehicleBrands(categoryId: string): void {
    this.brandsService
      .getVehicleBrandsByCategory(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (brands) =>
          this.availableBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
        error: () => this.availableBrands.set([]),
      });
  }

  private loadSimpleBrands(categoryId: string): void {
    this.brandsService
      .getByCategory(categoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (brands) =>
          this.availableBrands.set(brands.map((b) => ({ _id: b._id, name: b.name }))),
        error: () => this.availableBrands.set([]),
      });
  }

  private resetBrandState(): void {
    this.availableBrands.set([]);
    this.availableModels.set([]);
    this.availableVariants.set([]);
    this.selectedBrandId.set('');
    this.selectedBrandName.set('');
    this.otherBrandName.set('');
    this.selectedModelId.set('');
    this.selectedModelName.set('');
    this.otherModelName.set('');
    this.selectedVariantId.set('');
    this.selectedVariantName.set('');
    this.otherVariantName.set('');
    this.brandSearch.set('');
    this.modelSearch.set('');
    this.variantSearch.set('');
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
    this.saveDraft();
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
    this.saveDraft();
  }

  selectVariant(id: string, name: string): void {
    this.selectedVariantId.set(id);
    this.selectedVariantName.set(name);
    this.otherVariantName.set('');
    this.openDropdown.set(null);
    this.variantSearch.set('');
    this.saveDraft();
  }

  isCategoryStepValid(): boolean {
    return this.selectedCategory() !== null;
  }

  toggleFeature(feature: string): void {
    this.selectedFeatures.update((features) => {
      if (features.includes(feature)) {
        return features.filter((f) => f !== feature);
      }
      return [...features, feature];
    });
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

  selectDropdownOption(key: string, value: string): void {
    this.getDynamicControl(key).setValue(value);
    this.getDynamicControl(key).markAsTouched();
    this.openDropdown.set(null);
  }

  selectCondition(value: string): void {
    this.detailsForm.get('condition')?.setValue(value);
    this.openDropdown.set(null);
  }

  onPriceKeydown(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const stripped = input.value.replace(/\D/g, '');
    if (stripped !== input.value) {
      input.value = stripped;
    }
    const numValue = stripped ? parseInt(stripped, 10) : null;
    this.detailsForm.get('price')?.setValue(numValue, { emitEvent: true });
  }

  // --- Details Step ---
  getDynamicControl(key: string): FormControl {
    if (!this.detailsForm.contains(key)) {
      this.detailsForm.addControl(key, new FormControl(''));
    }
    return this.detailsForm.get(key) as FormControl;
  }

  isDetailsStepValid(): boolean {
    const baseValid =
      this.detailsForm.get('title')!.valid &&
      this.detailsForm.get('description')!.valid &&
      this.detailsForm.get('price')!.valid &&
      this.detailsForm.get('condition')!.valid;

    if (!baseValid) return false;

    // Check for phone numbers in title and description
    const title = this.detailsForm.get('title')?.value || '';
    const description = this.detailsForm.get('description')?.value || '';
    if (this.containsPhoneNumber(title)) {
      this.phoneInAdError.set(
        'Phone numbers are not allowed in the title. Buyers will contact you through the app.',
      );
      return false;
    }
    if (this.containsPhoneNumber(description)) {
      this.phoneInAdError.set(
        'Phone numbers are not allowed in the description. Buyers will contact you through the app.',
      );
      return false;
    }
    this.phoneInAdError.set('');

    for (const attr of this.categoryAttributes()) {
      if (attr.required) {
        const ctrl = this.detailsForm.get(attr.key);
        if (!ctrl || !ctrl.value) return false;
      }
    }

    // Validate brand selection for hasBrands categories
    if (this.hasBrands()) {
      const brandId = this.selectedBrandId();
      if (!brandId) return false;
      if (brandId === OTHER_OPTION_ID && !this.otherBrandName().trim()) return false;

      // Vehicle categories require model
      if (this.isVehicleCategory()) {
        const modelId = this.selectedModelId();
        if (!modelId) return false;
        if (modelId === OTHER_OPTION_ID && !this.otherModelName().trim()) return false;
        // Variant is optional — no validation needed
      }
    }

    return true;
  }

  // --- Media Step ---
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files) this.processFiles(files);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.processFiles(input.files);
  }

  async processFiles(files: FileList): Promise<void> {
    this.draftMediaWarning.set(false);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        if (this.mediaItems().length >= 20) continue;
        const hash = await computeFileHash(file);
        const existingHashes = this.mediaItems().map((m) => m.hash);
        if (existingHashes.includes(hash)) {
          this.error.set(ERROR_MSG.DUPLICATE_IMAGE);
          continue;
        }
        const preview = URL.createObjectURL(file);
        this.mediaItems.update((items) => [...items, { file, preview, type: 'image', hash }]);
      } else if (file.type.startsWith('video/')) {
        if (this.videoItem()) continue;
        const preview = URL.createObjectURL(file);
        this.videoItem.set({ file, preview, type: 'video' });
      }
    }
  }

  removeImage(index: number): void {
    this.mediaItems.update((items) => {
      const removed = items[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return items.filter((_, i) => i !== index);
    });
  }

  removeVideo(): void {
    const v = this.videoItem();
    if (v) URL.revokeObjectURL(v.preview);
    this.videoItem.set(null);
  }

  moveImage(from: number, to: number): void {
    if (to < 0 || to >= this.mediaItems().length) return;
    this.mediaItems.update((items) => {
      const arr = [...items];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }

  isMediaStepValid(): boolean {
    const images = this.mediaItems().length;
    const video = this.videoItem() ? 1 : 0;
    return images >= 1 && images + video >= 2;
  }

  // --- Location Step ---
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
        error: () => {},
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
        error: () => {},
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

  isLocationStepValid(): boolean {
    return this.locationForm.valid;
  }

  // --- Navigation ---
  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return this.isCategoryStepValid();
      case 2:
        return this.isDetailsStepValid();
      case 3:
        return this.isMediaStepValid();
      case 4:
        return this.isLocationStepValid();
      case 5:
        return true;
      default:
        return false;
    }
  }

  showStepErrors = signal(false);
  phoneInAdError = signal('');

  private containsPhoneNumber(text: string): boolean {
    if (!text) return false;
    // Strategy 1: Normalize spaces/dashes between digits and check
    const normalized = text.replace(/(\d)[\s\-\.]+(\d)/g, '$1$2');
    const patterns = [
      /\b0[3][0-9]{9}\b/,
      /\b0[2-9][0-9]{8,9}\b/,
      /\+92[\s\-]?[0-9]{10}\b/,
      /0092[\s\-]?[0-9]{10}\b/,
    ];
    if (patterns.some((p) => p.test(normalized))) return true;

    // Strategy 2: Strip ALL non-digits, then scan for Pakistani patterns in the digit stream
    const digits = text.replace(/\D/g, '');
    const digitPatterns = [
      /0[3][0-9]{9}/, // 03xxxxxxxxx
      /920[3][0-9]{9}/, // 9203xxxxxxxxx (+92 without +)
      /00920[3][0-9]{9}/, // 009203xxxxxxxxx
    ];
    if (digitPatterns.some((p) => p.test(digits))) return true;

    return false;
  }

  nextStep(): void {
    const step = this.currentStep();
    if (step >= this.totalSteps) return;

    if (!this.isStepValid(step)) {
      this.showStepErrors.set(true);

      // Mark form fields as touched to show validation errors
      if (step === 2) {
        this.detailsForm.markAllAsTouched();
        // Also mark dynamic attribute controls
        for (const attr of this.categoryAttributes()) {
          this.getDynamicControl(attr.key).markAsTouched();
        }
      }
      if (step === 4) {
        this.locationForm.markAllAsTouched();
      }

      // Scroll to first error
      setTimeout(() => {
        const errorEl = document.querySelector('.form-error, .ng-invalid.ng-touched');
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    this.showStepErrors.set(false);
    this.error.set('');
    this.currentStep.update((s) => s + 1);
    this.saveDraft();
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.error.set('');
      this.currentStep.update((s) => s - 1);
      this.saveDraft();
    }
  }

  goToStep(step: number): void {
    for (let i = 1; i < step; i++) {
      if (!this.isStepValid(i)) return;
    }
    this.error.set('');
    this.currentStep.set(step);
  }

  // --- Review & Submit ---
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

  onPackageSelected(purchaseId: string): void {
    this.selectedPurchaseId.set(purchaseId);
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

    const payload: CreateListingPayload = {
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
        province: this.selectedProvince()?.name || undefined,
        city: loc.city,
        area: loc.area || undefined,
        blockPhase: loc.blockPhase || undefined,
        mapLink: loc.mapLink?.trim() || undefined,
      },
      isFeatured: this.featureAd(),
    };

    // Include purchaseId if a package was selected
    if (this.selectedPurchaseId()) {
      payload.purchaseId = this.selectedPurchaseId();
    }

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

    this.listingsService.create(payload).subscribe({
      next: (listing) => {
        // Upload images sequentially after listing is created
        this.clearDraft();
        this.tracker.track(TrackingEvent.LISTING_CREATE, {
          productListingId: listing._id,
          categoryId: cat._id,
          metadata: { title: details.title, price: details.price, city: loc.city },
        });
        this.uploadImages(listing._id, 0);
      },
      error: (err) => {
        this.submitting.set(false);
        const message = err?.error?.message ?? ERROR_MSG.LISTING_CREATE_FAILED;
        this.error.set(message);

        // If the error is package-related, clear the selection and refresh available packages
        const packageErrors = ['package', 'expired', 'fully used', 'not available'];
        const isPackageError = packageErrors.some((keyword) =>
          message.toLowerCase().includes(keyword),
        );
        if (isPackageError && this.selectedPurchaseId()) {
          this.selectedPurchaseId.set('');
          // Trigger AvailablePackagesComponent refresh by toggling categoryId
          const catId = this.selectedCategory()?._id ?? null;
          this.packageCategoryId.set(null);
          setTimeout(() => this.packageCategoryId.set(catId), 0);
        }
      },
    });
  }

  private navigateToListing(listingId: string): void {
    const title = this.detailsForm.get('title')?.value ?? '';
    const slug = listingSlug({ _id: listingId, title });
    this.router.navigate([ROUTES.LISTINGS, slug]);
  }

  private uploadImages(listingId: string, index: number): void {
    const items = this.mediaItems();
    if (index >= items.length) {
      const video = this.videoItem();
      if (video) {
        this.uploadVideo(listingId, video);
      } else {
        this.submitting.set(false);
        this.navigateToListing(listingId);
      }
      return;
    }

    const item = items[index];
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('type', 'image');
    formData.append('sortOrder', String(index));

    this.listingsService.uploadMedia(listingId, formData).subscribe({
      next: () => this.uploadImages(listingId, index + 1),
      error: () => {
        // Continue even if one upload fails
        this.uploadImages(listingId, index + 1);
      },
    });
  }

  private uploadVideo(listingId: string, video: MediaItem): void {
    const formData = new FormData();
    formData.append('file', video.file);
    formData.append('type', 'video');

    this.listingsService.uploadMedia(listingId, formData).subscribe({
      next: () => {
        this.submitting.set(false);
        this.navigateToListing(listingId);
      },
      error: () => {
        this.submitting.set(false);
        this.navigateToListing(listingId);
      },
    });
  }
}
