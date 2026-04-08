import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, CreateListingPayload } from '../../../core/services/listings.service';
import { Category, CategoryAttribute, Listing } from '../../../core/models';

@Component({
  selector: 'app-edit-listing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-listing.component.html',
  styleUrls: ['../create-listing/create-listing.component.scss'],
})
export class EditListingComponent implements OnInit {
  listingId = '';
  listing = signal<Listing | null>(null);
  loading = signal(true);

  currentStep = signal(1);
  totalSteps = 5;
  stepLabels = ['Category', 'Details', 'Media', 'Location', 'Review'];

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

  detailsForm!: FormGroup;
  locationForm!: FormGroup;
  featureAd = signal(false);
  submitting = signal(false);
  error = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly listingsService: ListingsService,
  ) {}

  ngOnInit(): void {
    this.detailsForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.required, Validators.maxLength(5000)]],
      price: [null, [Validators.required, Validators.min(1)]],
      condition: ['used', Validators.required],
    });

    this.locationForm = this.fb.group({
      city: ['', Validators.required],
      area: ['', Validators.required],
    });

    this.listingId = this.route.snapshot.paramMap.get('id') ?? '';

    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.allCategories.set(cats);
        this.loadListing();
      },
      error: () => {
        this.allCategories.set([]);
        this.loadListing();
      },
    });
  }

  private loadListing(): void {
    if (!this.listingId) {
      this.loading.set(false);
      return;
    }

    this.listingsService.getById(this.listingId).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.populateForm(listing);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load listing');
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

    this.locationForm.patchValue({
      city: listing.location.city,
      area: listing.location.area,
    });

    this.featureAd.set(listing.isFeatured);

    // Restore selected features
    this.selectedFeatures.set(listing.selectedFeatures || []);

    // Restore category selection
    if (listing.categoryPath?.length > 0) {
      const cats = this.allCategories();
      const l1 = cats.find(c => c._id === listing.categoryPath[0]);
      if (l1) {
        this.selectLevel1(l1);
        if (listing.categoryPath.length > 1) {
          const l2 = cats.find(c => c._id === listing.categoryPath[1]);
          if (l2) {
            this.selectLevel2(l2);
            if (listing.categoryPath.length > 2) {
              const l3 = cats.find(c => c._id === listing.categoryPath[2]);
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
  }

  selectLevel1(cat: Category): void {
    this.selectedLevel1.set(cat);
    this.selectedLevel2.set(null);
    this.selectedLevel3.set(null);
    this.level3Categories.set([]);
    this.selectedFeatures.set([]);
    this.level2Categories.set(this.allCategories().filter(c => c.parentId === cat._id && c.isActive));
  }

  selectLevel2(cat: Category): void {
    this.selectedLevel2.set(cat);
    this.selectedLevel3.set(null);
    this.selectedFeatures.set([]);
    this.level3Categories.set(this.allCategories().filter(c => c.parentId === cat._id && c.isActive));
  }

  selectLevel3(cat: Category): void {
    this.selectedLevel3.set(cat);
    this.selectedFeatures.set([]);
  }

  toggleFeature(feature: string): void {
    this.selectedFeatures.update(features => {
      if (features.includes(feature)) {
        return features.filter(f => f !== feature);
      }
      return [...features, feature];
    });
  }

  getDynamicControl(key: string): FormControl {
    if (!this.detailsForm.contains(key)) {
      this.detailsForm.addControl(key, new FormControl(''));
    }
    return this.detailsForm.get(key) as FormControl;
  }

  isCategoryStepValid(): boolean { return this.selectedCategory() !== null; }

  isDetailsStepValid(): boolean {
    const base = this.detailsForm.get('title')!.valid
      && this.detailsForm.get('description')!.valid
      && this.detailsForm.get('price')!.valid
      && this.detailsForm.get('condition')!.valid;
    if (!base) return false;
    for (const attr of this.categoryAttributes()) {
      if (attr.required && !this.detailsForm.get(attr.key)?.value) return false;
    }
    return true;
  }

  isLocationStepValid(): boolean { return this.locationForm.valid; }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1: return this.isCategoryStepValid();
      case 2: return this.isDetailsStepValid();
      case 3: return true; // Media already exists for edit
      case 4: return this.isLocationStepValid();
      case 5: return true;
      default: return false;
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps && this.isStepValid(this.currentStep())) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
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

  toggleFeatureAd(): void { this.featureAd.update(v => !v); }

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
      price: { amount: details.price, currency: 'PKR' },
      categoryId: cat._id,
      categoryPath: this.buildCategoryPathIds(),
      condition: details.condition,
      categoryAttributes: catAttrs,
      selectedFeatures: this.selectedFeatures(),
      location: { city: loc.city, area: loc.area },
      isFeatured: this.featureAd(),
    };

    this.listingsService.update(this.listingId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/listings', this.listingId]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update listing.');
      },
    });
  }
}
