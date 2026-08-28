import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import {
  AD_CAMPAIGN_STATUS_LABELS,
  AD_PLACEMENT_LABELS,
  AdCampaign,
  AdCampaignPayload,
  AdCampaignStatus,
  AdCreative,
  AdCreativePayload,
  AdDevice,
  AdPlacement,
  AdPricingModel,
  Advertiser,
  Category,
  Province,
} from '../../../core/models';

/** Form shape for a campaign, kept flat so it binds directly to inputs. */
interface CampaignForm {
  advertiserId: string;
  name: string;
  status: AdCampaignStatus;
  startAt: string;
  endAt: string;
  priority: number;
  pricingModel: AdPricingModel;
  budgetAmount: number;
  currency: string;
  maxImpressions: number;
  maxClicks: number;
  dailyImpressionCap: number;
  placements: AdPlacement[];
  categoryIds: string[];
  provinceIds: string[];
  devices: AdDevice[];
}

interface CreativeForm {
  placement: AdPlacement | '';
  title: string;
  body: string;
  imageUrl: string;
  mobileImageUrl: string;
  altText: string;
  /** Which kind of destination the operator is entering. */
  destinationKind: 'external' | 'internal';
  destinationUrl: string;
  routeLink: string;
  ctaLabel: string;
  weight: number;
  isActive: boolean;
}

/**
 * Manages ad campaigns and the creatives inside them.
 *
 * Scheduling, targeting and delivery caps live on the campaign; each creative is
 * one renderable ad for a specific placement. The API enforces that a creative's
 * placement is one the campaign actually bought, so the creative form only offers
 * the campaign's own placements.
 */
@Component({
  selector: 'app-ad-campaign-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-campaign-manager.component.html',
  styleUrls: ['./advertising-admin.scss'],
})
export class AdCampaignManagerComponent implements OnInit, OnDestroy {
  readonly PLACEMENT_LABELS = AD_PLACEMENT_LABELS;
  readonly STATUS_LABELS = AD_CAMPAIGN_STATUS_LABELS;
  readonly placementOptions = Object.keys(AD_PLACEMENT_LABELS) as AdPlacement[];
  readonly statusOptions = Object.keys(AD_CAMPAIGN_STATUS_LABELS) as AdCampaignStatus[];
  readonly pricingOptions: AdPricingModel[] = ['cpm', 'cpc', 'flat'];
  readonly deviceOptions: AdDevice[] = ['mobile', 'desktop'];

  readonly campaigns = signal<AdCampaign[]>([]);
  readonly advertisers = signal<Advertiser[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly provinces = signal<Province[]>([]);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);

  readonly filterStatus = signal<string>('');
  readonly filterAdvertiser = signal<string>('');

  readonly campaignFormOpen = signal(false);
  readonly editingCampaign = signal<AdCampaign | null>(null);
  campaignForm: CampaignForm = this.emptyCampaignForm();

  /** Campaign whose creatives are expanded, with its loaded creatives. */
  readonly expandedCampaignId = signal<string>('');
  readonly creatives = signal<AdCreative[]>([]);
  readonly creativesLoading = signal(false);

  readonly creativeFormOpen = signal(false);
  readonly editingCreative = signal<AdCreative | null>(null);
  creativeForm: CreativeForm = this.emptyCreativeForm();

  readonly pendingDeleteCampaign = signal<AdCampaign | null>(null);
  readonly pendingDeleteCreative = signal<AdCreative | null>(null);

  readonly advertiserNames = computed(
    () => new Map(this.advertisers().map((a) => [a._id, a.name])),
  );

  readonly filteredCampaigns = computed(() => {
    const status = this.filterStatus();
    const advertiserId = this.filterAdvertiser();
    return this.campaigns().filter(
      (campaign) =>
        (!status || campaign.status === status) &&
        (!advertiserId || campaign.advertiserId === advertiserId),
    );
  });

  /** Placements the expanded campaign bought, for the creative form. */
  readonly availablePlacements = computed<AdPlacement[]>(() => {
    const campaign = this.campaigns().find((c) => c._id === this.expandedCampaignId());
    return campaign?.targeting?.placements ?? [];
  });

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly advertising: AdvertisingService,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    // One pass so the table can show brand names and the form can offer
    // targeting options without a second round of spinners.
    forkJoin({
      campaigns: this.advertising.listCampaigns(),
      advertisers: this.advertising.listAdvertisers(),
      categories: this.categoriesService.getAll(),
      provinces: this.locationService.getProvinces(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ campaigns, advertisers, categories, provinces }) => {
          this.campaigns.set(campaigns);
          this.advertisers.set(advertisers);
          this.categories.set(categories.filter((c) => c.isActive));
          this.provinces.set(provinces);
          this.loading.set(false);
          this.loadFailed.set(false);
        },
        error: () => {
          this.error.set('Could not load campaigns.');
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  advertiserName(id: string): string {
    return this.advertiserNames().get(id) ?? 'Unknown advertiser';
  }

  /** Human summary of delivery against caps, or a dash when uncapped. */
  capSummary(campaign: AdCampaign): string {
    const parts: string[] = [];
    if (campaign.maxImpressions > 0) {
      parts.push(`${campaign.metrics.impressions}/${campaign.maxImpressions} impr`);
    }
    if (campaign.maxClicks > 0) {
      parts.push(`${campaign.metrics.clicks}/${campaign.maxClicks} clicks`);
    }
    if (campaign.dailyImpressionCap > 0) {
      parts.push(`${campaign.dailyImpressionCap}/day`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Uncapped';
  }

  ctr(campaign: AdCampaign): string {
    const { impressions, clicks } = campaign.metrics;
    if (impressions <= 0) return '—';
    return `${Math.round((clicks / impressions) * 10000) / 100}%`;
  }

  statusClass(status: AdCampaignStatus): string {
    if (status === 'active') return '';
    if (status === 'paused' || status === 'scheduled') return 'ads-badge-warn';
    if (status === 'completed' || status === 'archived') return 'ads-badge-muted';
    return 'ads-badge-muted';
  }

  // ── Campaign form ─────────────────────────────────────────────────

  openCreateCampaign(): void {
    this.editingCampaign.set(null);
    this.campaignForm = this.emptyCampaignForm();
    this.error.set('');
    this.campaignFormOpen.set(true);
  }

  openEditCampaign(campaign: AdCampaign): void {
    this.editingCampaign.set(campaign);
    this.campaignForm = {
      advertiserId: campaign.advertiserId,
      name: campaign.name,
      status: campaign.status,
      startAt: this.toDateInput(campaign.startAt),
      endAt: this.toDateInput(campaign.endAt),
      priority: campaign.priority,
      pricingModel: campaign.pricingModel,
      budgetAmount: campaign.budgetAmount,
      currency: campaign.currency,
      maxImpressions: campaign.maxImpressions,
      maxClicks: campaign.maxClicks,
      dailyImpressionCap: campaign.dailyImpressionCap,
      placements: [...(campaign.targeting?.placements ?? [])],
      categoryIds: [...(campaign.targeting?.categoryIds ?? [])],
      provinceIds: [...(campaign.targeting?.provinceIds ?? [])],
      devices: [...(campaign.targeting?.devices ?? [])],
    };
    this.error.set('');
    this.campaignFormOpen.set(true);
  }

  closeCampaignForm(): void {
    this.campaignFormOpen.set(false);
    this.editingCampaign.set(null);
  }

  togglePlacement(placement: AdPlacement): void {
    const current = this.campaignForm.placements;
    this.campaignForm.placements = current.includes(placement)
      ? current.filter((p) => p !== placement)
      : [...current, placement];
  }

  toggleCategory(id: string): void {
    const current = this.campaignForm.categoryIds;
    this.campaignForm.categoryIds = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
  }

  toggleProvince(id: string): void {
    const current = this.campaignForm.provinceIds;
    this.campaignForm.provinceIds = current.includes(id)
      ? current.filter((p) => p !== id)
      : [...current, id];
  }

  toggleDevice(device: AdDevice): void {
    const current = this.campaignForm.devices;
    this.campaignForm.devices = current.includes(device)
      ? current.filter((d) => d !== device)
      : [...current, device];
  }

  /** Explains why the form cannot be saved, or `''` when it can. */
  campaignFormError(): string {
    const form = this.campaignForm;
    if (!form.advertiserId) return 'Choose an advertiser.';
    if (form.name.trim().length < 2) return 'Give the campaign a name.';
    if (!form.startAt || !form.endAt) return 'Set both a start and an end date.';
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      return 'The end date must be after the start date.';
    }
    if (form.placements.length === 0) {
      return 'Select at least one placement, or the campaign has nowhere to run.';
    }
    return '';
  }

  saveCampaign(): void {
    if (this.campaignFormError() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    const form = this.campaignForm;
    const payload: AdCampaignPayload = {
      advertiserId: form.advertiserId,
      name: form.name.trim(),
      status: form.status,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      priority: Number(form.priority) || 5,
      pricingModel: form.pricingModel,
      budgetAmount: Number(form.budgetAmount) || 0,
      currency: form.currency || 'PKR',
      maxImpressions: Number(form.maxImpressions) || 0,
      maxClicks: Number(form.maxClicks) || 0,
      dailyImpressionCap: Number(form.dailyImpressionCap) || 0,
      targeting: {
        placements: form.placements,
        categoryIds: form.categoryIds,
        provinceIds: form.provinceIds,
        devices: form.devices,
      },
    };

    const existing = this.editingCampaign();
    const request = existing
      ? this.advertising.updateCampaign(existing._id, payload)
      : this.advertising.createCampaign(payload);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCampaignForm();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(existing ? 'Could not update campaign.' : 'Could not create campaign.');
      },
    });
  }

  /** Quick status change from the table, for pausing or resuming. */
  setStatus(campaign: AdCampaign, status: AdCampaignStatus): void {
    this.saving.set(true);
    this.advertising
      .updateCampaign(campaign._id, { status })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not change campaign status.');
        },
      });
  }

  requestDeleteCampaign(campaign: AdCampaign): void {
    this.pendingDeleteCampaign.set(campaign);
    this.error.set('');
  }

  cancelDeleteCampaign(): void {
    this.pendingDeleteCampaign.set(null);
  }

  confirmDeleteCampaign(): void {
    const campaign = this.pendingDeleteCampaign();
    if (!campaign) return;
    this.saving.set(true);
    this.advertising
      .deleteCampaign(campaign._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.pendingDeleteCampaign.set(null);
          if (this.expandedCampaignId() === campaign._id) {
            this.expandedCampaignId.set('');
            this.creatives.set([]);
          }
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.pendingDeleteCampaign.set(null);
          this.error.set('Could not delete campaign.');
        },
      });
  }

  // ── Creatives ─────────────────────────────────────────────────────

  toggleCreatives(campaign: AdCampaign): void {
    if (this.expandedCampaignId() === campaign._id) {
      this.expandedCampaignId.set('');
      this.creatives.set([]);
      return;
    }
    this.expandedCampaignId.set(campaign._id);
    this.loadCreatives(campaign._id);
  }

  private loadCreatives(campaignId: string): void {
    this.creativesLoading.set(true);
    this.advertising
      .listCreatives(campaignId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (creatives) => {
          this.creatives.set(creatives);
          this.creativesLoading.set(false);
        },
        error: () => {
          this.creatives.set([]);
          this.creativesLoading.set(false);
          this.error.set('Could not load creatives.');
        },
      });
  }

  openCreateCreative(): void {
    this.editingCreative.set(null);
    this.creativeForm = this.emptyCreativeForm();
    // Default to the campaign's first placement so the form starts valid.
    this.creativeForm.placement = this.availablePlacements()[0] ?? '';
    this.error.set('');
    this.creativeFormOpen.set(true);
  }

  openEditCreative(creative: AdCreative): void {
    this.editingCreative.set(creative);
    this.creativeForm = {
      placement: creative.placement,
      title: creative.title,
      body: creative.body ?? '',
      imageUrl: creative.imageUrl,
      mobileImageUrl: creative.mobileImageUrl ?? '',
      altText: creative.altText,
      destinationKind: creative.routeLink ? 'internal' : 'external',
      destinationUrl: creative.destinationUrl ?? '',
      routeLink: creative.routeLink ?? '',
      ctaLabel: creative.ctaLabel ?? '',
      weight: creative.weight,
      isActive: creative.isActive,
    };
    this.error.set('');
    this.creativeFormOpen.set(true);
  }

  closeCreativeForm(): void {
    this.creativeFormOpen.set(false);
    this.editingCreative.set(null);
  }

  /** Explains why the creative cannot be saved, or `''` when it can. */
  creativeFormError(): string {
    const form = this.creativeForm;
    if (!form.placement) return 'Choose a placement.';
    if (form.title.trim().length < 2) return 'Give the creative a title.';
    if (!form.imageUrl.trim()) return 'An image URL is required.';
    if (form.altText.trim().length < 2) {
      return 'Alt text is required so the ad is readable by screen readers.';
    }
    // Exactly one destination: the API rejects both or neither.
    if (form.destinationKind === 'external' && !form.destinationUrl.trim()) {
      return 'Enter the advertiser’s URL.';
    }
    if (form.destinationKind === 'internal' && !form.routeLink.trim()) {
      return 'Enter the internal route this ad should open.';
    }
    return '';
  }

  saveCreative(): void {
    if (this.creativeFormError() || this.saving()) return;
    const campaignId = this.expandedCampaignId();
    if (!campaignId) return;

    this.saving.set(true);
    this.error.set('');

    const form = this.creativeForm;
    const payload: AdCreativePayload = {
      campaignId,
      placement: form.placement as AdPlacement,
      title: form.title.trim(),
      imageUrl: form.imageUrl.trim(),
      altText: form.altText.trim(),
      weight: Number(form.weight) || 1,
      isActive: form.isActive,
    };
    if (form.body.trim()) payload.body = form.body.trim();
    if (form.mobileImageUrl.trim()) payload.mobileImageUrl = form.mobileImageUrl.trim();
    if (form.ctaLabel.trim()) payload.ctaLabel = form.ctaLabel.trim();
    if (form.destinationKind === 'external') {
      payload.destinationUrl = form.destinationUrl.trim();
    } else {
      payload.routeLink = form.routeLink.trim();
    }

    const existing = this.editingCreative();
    const request = existing
      ? this.advertising.updateCreative(existing._id, payload)
      : this.advertising.createCreative(payload);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreativeForm();
        this.loadCreatives(campaignId);
        // Refresh the table so metrics and counts stay in step.
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(existing ? 'Could not update creative.' : 'Could not create creative.');
      },
    });
  }

  toggleCreativeActive(creative: AdCreative): void {
    this.saving.set(true);
    this.advertising
      .updateCreative(creative._id, { isActive: !creative.isActive })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.loadCreatives(creative.campaignId);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not change creative status.');
        },
      });
  }

  requestDeleteCreative(creative: AdCreative): void {
    this.pendingDeleteCreative.set(creative);
    this.error.set('');
  }

  cancelDeleteCreative(): void {
    this.pendingDeleteCreative.set(null);
  }

  confirmDeleteCreative(): void {
    const creative = this.pendingDeleteCreative();
    if (!creative) return;
    this.saving.set(true);
    this.advertising
      .deleteCreative(creative._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.pendingDeleteCreative.set(null);
          this.loadCreatives(creative.campaignId);
        },
        error: () => {
          this.saving.set(false);
          this.pendingDeleteCreative.set(null);
          this.error.set('Could not delete creative.');
        },
      });
  }

  /** Runs the schedule sweep on demand instead of waiting for the hourly cron. */
  syncStatuses(): void {
    this.saving.set(true);
    this.advertising
      .syncCampaignStatuses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not sync campaign statuses.');
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /** `datetime-local` needs `YYYY-MM-DDTHH:mm` in local time. */
  private toDateInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  private emptyCampaignForm(): CampaignForm {
    const now = new Date();
    const inAMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      advertiserId: '',
      name: '',
      status: 'draft',
      startAt: this.toDateInput(now.toISOString()),
      endAt: this.toDateInput(inAMonth.toISOString()),
      priority: 5,
      pricingModel: 'flat',
      budgetAmount: 0,
      currency: 'PKR',
      maxImpressions: 0,
      maxClicks: 0,
      dailyImpressionCap: 0,
      placements: [],
      categoryIds: [],
      provinceIds: [],
      devices: [],
    };
  }

  private emptyCreativeForm(): CreativeForm {
    return {
      placement: '',
      title: '',
      body: '',
      imageUrl: '',
      mobileImageUrl: '',
      altText: '',
      destinationKind: 'external',
      destinationUrl: '',
      routeLink: '',
      ctaLabel: '',
      weight: 1,
      isActive: true,
    };
  }
}
