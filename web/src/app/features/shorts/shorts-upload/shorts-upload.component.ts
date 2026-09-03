import { Component, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NumberToWordsPipe } from '../../../shared/pipes/number-to-words.pipe';
import {
  ShortsService,
  ShortsStats,
  UsableShortsPackage,
} from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { ListingsService } from '../../../core/services/listings.service';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PromoBannerComponent } from '../../../shared/components/promo-banner/promo-banner.component';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { ToastService } from '../../../core/services/toast.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import {
  FREE_SHORTS_PER_MONTH,
  SHORTS_ALLOWED_MIMETYPES,
  SHORTS_MAX_FILE_SIZE,
  SHORTS_ACCEPT_STRING,
  CURRENCY_SYMBOL,
} from '../../../core/constants/app';
import { Category, Province, City, Area, Listing } from '../../../core/models';

@Component({
  selector: 'app-shorts-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CustomSelectComponent,
    PromoBannerComponent,
    NumberToWordsPipe,
  ],
  templateUrl: './shorts-upload.component.html',
  styleUrl: './shorts-upload.component.scss',
})
export class ShortsUploadComponent {
  readonly ROUTES = ROUTES;
  readonly FREE_SHORTS_PER_MONTH = FREE_SHORTS_PER_MONTH;
  readonly SHORTS_ACCEPT_STRING = SHORTS_ACCEPT_STRING;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  @ViewChild('previewVideo') previewVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraVideo') cameraVideoRef!: ElementRef<HTMLVideoElement>;

  readonly videoFile = signal<File | null>(null);
  readonly videoPreviewUrl = signal<string>('');
  readonly videoDuration = signal(0);
  readonly stats = signal<ShortsStats | null>(null);

  // Paid shorts credit. Without this the upload could only ever use the free
  // monthly allowance, so a purchased package delivered nothing.
  readonly usablePackages = signal<UsableShortsPackage[]>([]);
  /** Empty string means "use the free monthly allowance". */
  readonly selectedPurchaseId = signal<string>('');

  readonly freeRemaining = computed(() => this.stats()?.freeRemainingThisMonth ?? 0);
  readonly hasUsablePackage = computed(() => this.usablePackages().length > 0);
  readonly paidRemaining = computed(() =>
    this.usablePackages().reduce((sum, p) => sum + p.remaining, 0),
  );

  /**
   * Free allowance first when there is any, then each package. Labelled with the
   * balance and expiry so the choice is informed rather than a bare id.
   */
  readonly packageOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [];
    if (this.freeRemaining() > 0) {
      options.push({
        value: '',
        label: `Free allowance (${this.freeRemaining()} left this month)`,
      });
    }
    for (const pkg of this.usablePackages()) {
      const expiry = pkg.expiresAt
        ? ` · expires ${new Date(pkg.expiresAt).toLocaleDateString()}`
        : '';
      options.push({
        value: pkg.purchaseId,
        label: `${pkg.packageName} — ${pkg.remaining} left${expiry}`,
      });
    }
    return options;
  });

  readonly selectedPackage = computed(() =>
    this.usablePackages().find((p) => p.purchaseId === this.selectedPurchaseId()),
  );

  /** Whether there is any way to post at all — free allowance or paid credit. */
  readonly canPostSomehow = computed(() => this.freeRemaining() > 0 || this.hasUsablePackage());
  readonly categories = signal<Category[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly cities = signal<City[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly isRecording = signal(false);
  readonly recordingTime = signal(0);

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
  selectedCity = '';
  selectedListingId = '';
  trimStart = 0;
  trimEnd = 60;
  Math = Math;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingInterval: any = null;
  private stream: MediaStream | null = null;

  constructor(
    private readonly shortsService: ShortsService,
    private readonly router: Router,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
    private readonly listingsService: ListingsService,
    private readonly confirmModal: ConfirmModalService,
    private readonly tracker: ActivityTrackerService,
    private readonly toast: ToastService,
  ) {
    this.loadStats();
    this.loadUsablePackages();
    this.loadCategories();
    this.loadProvinces();
    this.loadMyListings();
  }

  private loadStats(): void {
    this.shortsService.getMyStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.applyDefaultPackageSelection();
      },
    });
  }

  private loadUsablePackages(): void {
    this.shortsService.getUsableShortsPackages().subscribe({
      next: (packages) => {
        this.usablePackages.set(packages);
        this.applyDefaultPackageSelection();
      },
      // A failure here must not block the free path, so it is left silent.
      error: () => this.usablePackages.set([]),
    });
  }

  /**
   * Spends the free allowance while it lasts, then falls back to paid credit.
   *
   * Called from both loaders because either may land first, and the default
   * depends on knowing the free balance and the package list together. Only ever
   * sets the default — a choice the seller has already made is left alone.
   */
  private applyDefaultPackageSelection(): void {
    if (this.selectedPurchaseId()) return;
    if (this.freeRemaining() > 0) return;
    // Soonest-expiring first, as ordered by the API, so credit closest to being
    // lost is the one offered.
    const first = this.usablePackages()[0];
    if (first) this.selectedPurchaseId.set(first.purchaseId);
  }

  onPackageSelected(purchaseId: string): void {
    this.selectedPurchaseId.set(purchaseId);
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
    this.selectedCity = '';
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
    const city = this.cities().find((c) => c._id === id);
    this.selectedCity = city?.name || '';
    if (id) {
      this.locationService.getAreas(id).subscribe({
        next: (areas) => this.areas.set(areas),
      });
    }
  }

  onAreaChange(id: string): void {
    this.selectedAreaId.set(id);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    // Validate type
    if (!SHORTS_ALLOWED_MIMETYPES.includes(file.type as any)) {
      this.error.set('Invalid format. Please use MP4, WebM, or MOV.');
      this.tracker.track(TrackingEvent.SHORT_UPLOAD_FAIL, {
        metadata: { error: 'invalid_format', type: file.type },
      });
      return;
    }

    // Validate size
    if (file.size > SHORTS_MAX_FILE_SIZE) {
      this.error.set('File too large. Maximum size is 15MB.');
      this.tracker.track(TrackingEvent.SHORT_UPLOAD_FAIL, {
        metadata: { error: 'file_too_large', size: file.size },
      });
      return;
    }

    this.error.set('');
    this.videoFile.set(file);
    this.videoPreviewUrl.set(URL.createObjectURL(file));

    // Get duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      this.videoDuration.set(video.duration);
      this.trimEnd = Math.min(60, Math.ceil(video.duration));
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  }

  removeFile(): void {
    this.videoFile.set(null);
    this.videoPreviewUrl.set('');
    this.videoDuration.set(0);
    this.error.set('');
  }

  async startCamera(): Promise<void> {
    this.tracker.track(TrackingEvent.SHORT_CAMERA_RECORD, {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 720, height: 1280 },
        audio: true,
      });

      this.isRecording.set(true);
      this.recordingTime.set(0);
      this.recordedChunks = [];

      // Wait for view to render
      setTimeout(() => {
        if (this.cameraVideoRef) {
          this.cameraVideoRef.nativeElement.srcObject = this.stream;
        }

        this.mediaRecorder = new MediaRecorder(this.stream!, {
          mimeType: 'video/webm;codecs=vp9',
        });

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.recordedChunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          const file = new File([blob], 'recorded-short.webm', { type: 'video/webm' });
          this.handleFile(file);
          this.isRecording.set(false);
          this.cleanupStream();
        };

        this.mediaRecorder.start(1000);

        // Timer - auto stop at 60s
        this.recordingInterval = setInterval(() => {
          this.recordingTime.update((t) => t + 1);
          if (this.recordingTime() >= 60) {
            this.stopRecording();
          }
        }, 1000);
      }, 100);
    } catch (err) {
      this.error.set('Camera access denied. Please allow camera permissions.');
      this.tracker.track(TrackingEvent.SHORT_UPLOAD_FAIL, { metadata: { error: 'camera_denied' } });
      this.isRecording.set(false);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  canSubmit(): boolean {
    return !!(
      this.videoFile() &&
      !this.uploading() &&
      this.title.trim() &&
      this.description.trim() &&
      this.price !== null &&
      this.price >= 0 &&
      this.selectedCategoryId &&
      this.selectedCityId() &&
      // Gated on the free allowance alone before, which disabled the button for
      // anyone who had run it out — including sellers holding a paid package.
      this.canPostSomehow() &&
      !(this.videoDuration() > 60 && this.trimEnd - this.trimStart > 60)
    );
  }

  async uploadShort(): Promise<void> {
    const file = this.videoFile();
    if (!file) return;

    if (!this.canPostSomehow()) {
      this.tracker.track(TrackingEvent.SHORT_LIMIT_REACHED, {});
      this.error.set(
        `You've used all ${FREE_SHORTS_PER_MONTH} free shorts this month. Purchase a package to upload more.`,
      );
      return;
    }

    // Falls back to the free allowance when no package is picked, and to a package
    // when the free allowance is gone.
    const paidPackage = this.selectedPackage();
    const freeRemaining = this.freeRemaining();
    const message = paidPackage
      ? `Upload this short using "${paidPackage.packageName}"? ` +
        `${paidPackage.remaining} upload${paidPackage.remaining > 1 ? 's' : ''} left on it, ` +
        `and this short stays live for ${paidPackage.durationDays} day(s).`
      : `Upload this short? You have ${freeRemaining} free upload${freeRemaining > 1 ? 's' : ''} remaining this month.`;

    const confirmed = await this.confirmModal.confirm({
      title: 'Upload Short',
      message,
      confirmText: 'Upload',
      cancelText: 'Cancel',
      variant: 'info',
    });

    if (!confirmed) return;

    this.uploading.set(true);
    this.error.set('');

    const formData = new FormData();
    formData.append('video', file);
    if (this.title) {
      formData.append('title', this.title);
    }
    if (this.description) {
      formData.append('description', this.description);
    }
    if (this.selectedCategoryId) {
      formData.append('categoryId', this.selectedCategoryId);
      const cat = this.categories().find((c) => c._id === this.selectedCategoryId);
      if (cat) {
        formData.append('categoryName', cat.name);
      }
    }
    if (this.price !== null && this.price >= 0) {
      formData.append('price', String(this.price));
    }
    // Location
    if (this.selectedProvinceId()) {
      formData.append('location[provinceId]', this.selectedProvinceId());
      const province = this.provinces().find((p) => p._id === this.selectedProvinceId());
      if (province) formData.append('location[province]', province.name);
    }
    if (this.selectedCityId()) {
      formData.append('location[cityId]', this.selectedCityId());
      const city = this.cities().find((c) => c._id === this.selectedCityId());
      if (city) formData.append('location[city]', city.name);
    }
    if (this.selectedAreaId()) {
      formData.append('location[areaId]', this.selectedAreaId());
      const area = this.areas().find((a) => a._id === this.selectedAreaId());
      if (area) formData.append('location[area]', area.name);
    }
    if (this.selectedListingId) {
      formData.append('linkedListingId', this.selectedListingId);
    }
    // Without this the backend always took the free monthly path, so purchased
    // packages were never spent and never usable.
    if (paidPackage) {
      formData.append('purchaseId', paidPackage.purchaseId);
    }

    this.tracker.track(TrackingEvent.SHORT_UPLOAD_START, {
      metadata: {
        hasPrice: !!this.price,
        hasListing: !!this.selectedListingId,
        categoryId: this.selectedCategoryId,
        isPaid: !!paidPackage,
      },
    });

    this.shortsService.uploadShort(formData).subscribe({
      next: () => {
        this.uploading.set(false);
        this.tracker.track(TrackingEvent.SHORT_UPLOAD_SUCCESS, {
          metadata: { categoryId: this.selectedCategoryId },
        });
        this.toast.success('Short uploaded! It will go live once approved.');
        this.router.navigate([ROUTES.LISTINGS_MY], { queryParams: { tab: 'shorts' } });
      },
      error: (err) => {
        this.uploading.set(false);
        this.tracker.track(TrackingEvent.SHORT_UPLOAD_FAIL, {
          metadata: { error: err.error?.message },
        });
        // Prefer the server's reason (e.g. bad file, limit reached) when present.
        const msg =
          typeof err?.error?.message === 'string'
            ? err.error.message
            : 'Upload failed. Please try again.';
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
