import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, CreateListingPayload } from '../../../core/services/listings.service';
import { PackagesService } from '../../../core/services/packages.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { Category, CategoryAttribute, User, Province, City, Area } from '../../../core/models';
import { ListingCondition } from '../../../core/constants/enums';
import { CONDITION_OPTIONS } from '../../../core/constants/select-options';
import { listingSlug } from '../../../core/utils/slug';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';

export interface MediaItem {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

@Component({
  selector: 'app-create-listing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-listing.component.html',
  styleUrls: ['./create-listing.component.scss'],
})
export class CreateListingComponent implements OnInit {
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
  level1Categories = computed(() => this.allCategories().filter(c => c.level === 1 && c.isActive));
  level2Categories = signal<Category[]>([]);
  level3Categories = signal<Category[]>([]);
  selectedLevel1 = signal<Category | null>(null);
  selectedLevel2 = signal<Category | null>(null);
  selectedLevel3 = signal<Category | null>(null);
  selectedCategory = computed(() => this.selectedLevel3() ?? this.selectedLevel2() ?? this.selectedLevel1());
  categoryAttributes = computed<CategoryAttribute[]>(() => this.selectedCategory()?.attributes ?? []);
  categoryFeatures = computed<string[]>(() => this.selectedCategory()?.features ?? []);
  selectedFeatures = signal<string[]>([]);

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
  readonly yearOptions: number[] = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() - i);

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
    return q ? all.filter(c => c.name.toLowerCase().includes(q)) : all;
  });
  filteredAreas = computed(() => {
    const q = this.areaSearch().toLowerCase().trim();
    const all = this.areasForListing();
    return q ? all.filter(a => a.name.toLowerCase().includes(q)) : all;
  });
  blockPhaseOptions = computed<string[]>(() => {
    const area = this.selectedAreaObj();
    if (!area) return [];
    return [...(area.subareas || []), ...(area.blockPhases || [])];
  });
  filteredBlockPhases = computed(() => {
    const q = this.blockPhaseSearch().toLowerCase().trim();
    const all = this.blockPhaseOptions();
    return q ? all.filter(b => b.toLowerCase().includes(q)) : all;
  });

  // Submission
  submitting = signal(false);
  error = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
    private readonly packagesService: PackagesService,
    private readonly authService: AuthService,
    private readonly locationService: LocationService,
    private readonly tracker: ActivityTrackerService,
  ) {}

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
    });

    // Check if user has a verified phone
    this.authService.fetchCurrentUser().subscribe({
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

    this.categoriesService.getAll().subscribe({
      next: (cats) => this.allCategories.set(cats),
      error: () => this.allCategories.set([]),
    });

    this.locationService.getProvinces().subscribe({
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

    this.authService.addPhone(phone).subscribe({
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
    const verify$ = phone === this.authService.user()?.phone
      ? this.authService.verifyPhone(phone, otp)
      : this.authService.verifyPhoneChange(otp);

    verify$.subscribe({
      next: () => {
        this.phoneSending.set(false);
        this.phoneVerified.set(true);
        this.phoneSuccess.set('Phone verified successfully!');
        this.loadFeaturedSlots();
        // Refresh user data
        this.authService.fetchCurrentUser().subscribe();
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

    const resend$ = phone === this.authService.user()?.phone
      ? this.authService.resendVerification(phone)
      : this.authService.addPhone(phone);

    resend$.subscribe({
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
    this.packagesService.getMyPurchases().subscribe({
      next: (res) => {
        const purchases = Array.isArray(res) ? res : res.data ?? [];
        const now = new Date();
        const remaining = purchases
          .filter((p: any) => p.type === 'featured_ads' && p.paymentStatus === 'completed' && p.expiresAt && new Date(p.expiresAt) > now)
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
    const children = this.allCategories().filter(c => c.parentId === cat._id && c.isActive);
    this.level2Categories.set(children);
  }

  selectLevel2(cat: Category): void {
    this.selectedLevel2.set(cat);
    this.selectedLevel3.set(null);
    this.selectedFeatures.set([]);
    const children = this.allCategories().filter(c => c.parentId === cat._id && c.isActive);
    this.level3Categories.set(children);
  }

  selectLevel3(cat: Category): void {
    this.selectedLevel3.set(cat);
    this.selectedFeatures.set([]);
  }

  isCategoryStepValid(): boolean {
    return this.selectedCategory() !== null;
  }

  toggleFeature(feature: string): void {
    this.selectedFeatures.update(features => {
      if (features.includes(feature)) {
        return features.filter(f => f !== feature);
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

  getDropdownLabel(key: string, options: string[] | undefined): string {
    const val = this.getDynamicControl(key).value;
    return val || '';
  }

  // --- Details Step ---
  getDynamicControl(key: string): FormControl {
    if (!this.detailsForm.contains(key)) {
      this.detailsForm.addControl(key, new FormControl(''));
    }
    return this.detailsForm.get(key) as FormControl;
  }

  isDetailsStepValid(): boolean {
    const baseValid = this.detailsForm.get('title')!.valid
      && this.detailsForm.get('description')!.valid
      && this.detailsForm.get('price')!.valid
      && this.detailsForm.get('condition')!.valid;

    if (!baseValid) return false;

    for (const attr of this.categoryAttributes()) {
      if (attr.required) {
        const ctrl = this.detailsForm.get(attr.key);
        if (!ctrl || !ctrl.value) return false;
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

  processFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        if (this.mediaItems().length >= 20) continue;
        const preview = URL.createObjectURL(file);
        this.mediaItems.update(items => [...items, { file, preview, type: 'image' }]);
      } else if (file.type.startsWith('video/')) {
        if (this.videoItem()) continue;
        const preview = URL.createObjectURL(file);
        this.videoItem.set({ file, preview, type: 'video' });
      }
    }
  }

  removeImage(index: number): void {
    this.mediaItems.update(items => {
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
    this.mediaItems.update(items => {
      const arr = [...items];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }

  isMediaStepValid(): boolean {
    const images = this.mediaItems().length;
    const video = this.videoItem() ? 1 : 0;
    return images >= 1 && (images + video) >= 2;
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
    this.locationService.getCities(province._id).subscribe({
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
    this.locationService.getAreas(city._id).subscribe({
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
      case 1: return this.isCategoryStepValid();
      case 2: return this.isDetailsStepValid();
      case 3: return this.isMediaStepValid();
      case 4: return this.isLocationStepValid();
      case 5: return true;
      default: return false;
    }
  }

  showStepErrors = signal(false);

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
    this.currentStep.update(s => s + 1);
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  goToStep(step: number): void {
    // Only allow going to steps that are reachable (all previous steps valid)
    for (let i = 1; i < step; i++) {
      if (!this.isStepValid(i)) return;
    }
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
    this.featureAd.update(v => !v);
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
      price: { amount: details.price, currency: 'PKR' },
      categoryId: cat._id,
      categoryPath: this.buildCategoryPathIds(),
      condition: details.condition,
      categoryAttributes: catAttrs,
      selectedFeatures: this.selectedFeatures(),
      location: { city: loc.city, area: loc.area || undefined, blockPhase: loc.blockPhase || undefined },
      isFeatured: this.featureAd(),
    };

    this.listingsService.create(payload).subscribe({
      next: (listing) => {
        // Upload images sequentially after listing is created
        this.tracker.track('listing_create', {
          productListingId: listing._id,
          categoryId: cat._id,
          metadata: { title: details.title, price: details.price, city: loc.city },
        });
        this.uploadImages(listing._id, 0);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Failed to create listing. Please try again.');
      },
    });
  }

  private navigateToListing(listingId: string): void {
    const title = this.detailsForm.get('title')?.value ?? '';
    const slug = listingSlug({ _id: listingId, title });
    this.router.navigate(['/listings', slug]);
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
