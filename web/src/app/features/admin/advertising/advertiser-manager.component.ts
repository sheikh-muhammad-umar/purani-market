import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AdvertisingService } from '../../../core/services/advertising.service';
import { Advertiser, AdvertiserPayload, AdvertiserStatus } from '../../../core/models';

/**
 * Manages the brands that buy advertising.
 *
 * An advertiser is just a contact record: campaigns reference it, so it exists
 * mainly to keep reporting and billing attached to a real company rather than
 * repeating a brand name on every campaign.
 */
@Component({
  selector: 'app-advertiser-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advertiser-manager.component.html',
  styleUrls: ['./advertising-admin.scss'],
})
export class AdvertiserManagerComponent implements OnInit, OnDestroy {
  readonly advertisers = signal<Advertiser[]>([]);
  readonly loading = signal(true);
  /** Only set when the initial load fails, so a failed save keeps the form. */
  readonly loadFailed = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly search = signal('');

  /** The advertiser being edited, or `null` when creating. */
  readonly editing = signal<Advertiser | null>(null);
  readonly formOpen = signal(false);

  /** Advertiser awaiting delete confirmation. */
  readonly pendingDelete = signal<Advertiser | null>(null);

  form: AdvertiserPayload = this.emptyForm();

  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.advertisers();
    return this.advertisers().filter(
      (advertiser) =>
        advertiser.name.toLowerCase().includes(query) ||
        (advertiser.contactEmail ?? '').toLowerCase().includes(query),
    );
  });

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly advertising: AdvertisingService) {}

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
    this.advertising
      .listAdvertisers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (advertisers) => {
          this.advertisers.set(advertisers);
          this.loading.set(false);
          this.loadFailed.set(false);
        },
        error: () => {
          this.error.set('Could not load advertisers.');
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.error.set('');
    this.formOpen.set(true);
  }

  openEdit(advertiser: Advertiser): void {
    this.editing.set(advertiser);
    this.form = {
      name: advertiser.name,
      contactName: advertiser.contactName ?? '',
      contactEmail: advertiser.contactEmail ?? '',
      contactPhone: advertiser.contactPhone ?? '',
      website: advertiser.website ?? '',
      logoUrl: advertiser.logoUrl ?? '',
      notes: advertiser.notes ?? '',
      status: advertiser.status,
    };
    this.error.set('');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  get canSave(): boolean {
    return this.form.name.trim().length >= 2 && !this.saving();
  }

  save(): void {
    if (!this.canSave) return;
    this.saving.set(true);
    this.error.set('');

    // Optional fields are omitted rather than sent blank: the API validates
    // email and URL shapes, and an empty string is not a valid either.
    const payload = this.cleanPayload(this.form);
    const existing = this.editing();
    const request = existing
      ? this.advertising.updateAdvertiser(existing._id, payload)
      : this.advertising.createAdvertiser(payload);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(existing ? 'Could not update advertiser.' : 'Could not create advertiser.');
      },
    });
  }

  requestDelete(advertiser: Advertiser): void {
    this.pendingDelete.set(advertiser);
    this.error.set('');
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const advertiser = this.pendingDelete();
    if (!advertiser) return;
    this.saving.set(true);

    this.advertising
      .deleteAdvertiser(advertiser._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.pendingDelete.set(null);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.pendingDelete.set(null);
          // The API refuses while campaigns still reference the advertiser, which
          // is the only expected failure here.
          this.error.set('Could not delete. Remove or reassign this advertiser’s campaigns first.');
        },
      });
  }

  toggleStatus(advertiser: Advertiser): void {
    const next: AdvertiserStatus = advertiser.status === 'active' ? 'inactive' : 'active';
    this.saving.set(true);
    this.advertising
      .updateAdvertiser(advertiser._id, { status: next })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not change status.');
        },
      });
  }

  private cleanPayload(form: AdvertiserPayload): AdvertiserPayload {
    const payload: AdvertiserPayload = { name: form.name.trim() };
    const optional: (keyof AdvertiserPayload)[] = [
      'contactName',
      'contactEmail',
      'contactPhone',
      'website',
      'logoUrl',
      'notes',
    ];
    for (const key of optional) {
      const value = (form[key] as string | undefined)?.trim();
      if (value) (payload as unknown as Record<string, unknown>)[key] = value;
    }
    if (form.status) payload.status = form.status;
    return payload;
  }

  private emptyForm(): AdvertiserPayload {
    return {
      name: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      logoUrl: '',
      notes: '',
      status: 'active',
    };
  }
}
