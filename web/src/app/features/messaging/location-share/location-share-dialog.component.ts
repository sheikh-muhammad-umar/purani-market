import { Component, computed, inject, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LocationPayload } from '../../../core/models';
import { extractCoordsFromMapLink } from '../../../core/utils/map-link';

/** How the currently selected point was obtained, for the confirmation copy. */
type PickSource = 'gps' | 'link' | 'coords';

/** Rounded to ~11m, which is as precise as a shared pin needs to be. */
const COORD_DP = 6;

@Component({
  selector: 'app-location-share-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './location-share-dialog.component.html',
  styleUrls: ['./location-share-dialog.component.scss'],
})
export class LocationShareDialogComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** Emitted with the chosen point when the user confirms. */
  readonly picked = output<LocationPayload>();

  /** Emitted when the dialog should close without sending. */
  readonly cancelled = output<void>();

  protected readonly latitude = signal<number | null>(null);
  protected readonly longitude = signal<number | null>(null);
  protected readonly source = signal<PickSource | null>(null);

  protected readonly locating = signal(false);
  protected readonly error = signal('');
  protected readonly linkInput = signal('');

  protected readonly hasSelection = computed(
    () => this.latitude() !== null && this.longitude() !== null,
  );

  protected readonly coordsLabel = computed(() => {
    if (!this.hasSelection()) return '';
    return `${this.latitude()!.toFixed(COORD_DP)}, ${this.longitude()!.toFixed(COORD_DP)}`;
  });

  protected readonly sourceLabel = computed(() => {
    switch (this.source()) {
      case 'gps':
        return 'Your current location';
      case 'link':
        return 'From the Google Maps link';
      case 'coords':
        return 'From the coordinates you entered';
      default:
        return '';
    }
  });

  /**
   * Google Maps embed for the selected point.
   *
   * Marked trusted because the URL is assembled here from two numbers that have
   * already been range-checked — no user text reaches it.
   */
  protected readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    if (!this.hasSelection()) return null;
    const q = `${this.latitude()},${this.longitude()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${q}&z=16&output=embed`,
    );
  });

  /** Opens Google Maps so the user can find a place and copy its link back. */
  protected readonly browseUrl = computed(() => {
    const q = this.hasSelection() ? `${this.latitude()},${this.longitude()}` : '';
    return q ? `https://www.google.com/maps?q=${q}` : 'https://www.google.com/maps';
  });

  protected useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.error.set('This browser cannot report your location.');
      return;
    }
    this.locating.set(true);
    this.error.set('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.select(pos.coords.latitude, pos.coords.longitude, 'gps');
        this.locating.set(false);
      },
      (err) => {
        this.locating.set(false);
        this.error.set(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is blocked. Allow it in your browser settings, or paste a map link below.'
            : 'Could not get your location. Try again, or paste a map link below.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  protected onLinkInput(event: Event): void {
    this.linkInput.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  /**
   * Resolves whatever is in the field: a Google or Apple Maps URL, or a bare
   * "lat, lng" pair. Both are things a user can get out of any map app without
   * this feature needing a geocoding API.
   */
  protected resolveLink(): void {
    const raw = this.linkInput().trim();
    if (!raw) return;

    const fromLink = extractCoordsFromMapLink(raw);
    if (fromLink) {
      this.select(fromLink.latitude, fromLink.longitude, 'link');
      return;
    }

    const pair = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) {
      const lat = Number(pair[1]);
      const lng = Number(pair[2]);
      if (this.inRange(lat, lng)) {
        this.select(lat, lng, 'coords');
        return;
      }
      this.error.set('Those coordinates are out of range.');
      return;
    }

    this.error.set(
      'That does not look like a map link. Open the place in Google Maps, copy the link, and paste it here.',
    );
  }

  protected clearSelection(): void {
    this.latitude.set(null);
    this.longitude.set(null);
    this.source.set(null);
    this.linkInput.set('');
    this.error.set('');
  }

  protected confirm(): void {
    if (!this.hasSelection()) return;
    this.picked.emit({
      latitude: this.latitude()!,
      longitude: this.longitude()!,
    });
  }

  private select(lat: number, lng: number, source: PickSource): void {
    if (!this.inRange(lat, lng)) {
      this.error.set('Those coordinates are out of range.');
      return;
    }
    this.latitude.set(lat);
    this.longitude.set(lng);
    this.source.set(source);
    this.error.set('');
  }

  private inRange(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    );
  }
}
