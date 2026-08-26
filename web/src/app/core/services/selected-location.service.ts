import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Area, City, Province } from '../models';
import { STORAGE_SELECTED_LOCATION } from '../constants/storage-keys';
import { DEFAULT_COUNTRY } from '../constants/app';

/**
 * Single source of truth for the shopper's selected location.
 *
 * The header renders a location picker twice — once in the desktop search bar
 * and once in the mobile search row — and only one is visible per breakpoint.
 * Holding the selection here rather than in either picker keeps them from
 * drifting apart when the viewport crosses a breakpoint.
 *
 * The persisted shape is read by `ListingsService`, `ActivityTrackerService`,
 * the home page and search results, so it must stay
 * `{ label, province, city, area }` exactly.
 */
@Injectable({ providedIn: 'root' })
export class SelectedLocationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly label = signal(DEFAULT_COUNTRY);
  readonly province = signal<Province | null>(null);
  readonly city = signal<City | null>(null);
  readonly area = signal<Area | null>(null);

  /** Reads back whatever a previous session stored. Safe to call on the server. */
  restore(): { provinceId?: string; cityId?: string } {
    if (!this.isBrowser) return {};
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (!raw) return {};
      const state = JSON.parse(raw);
      if (state.label) this.label.set(state.label);
      if (state.province) this.province.set(state.province);
      if (state.city) this.city.set(state.city);
      if (state.area) this.area.set(state.area);
      return { provinceId: state.province?._id, cityId: state.city?._id };
    } catch {
      // Corrupted entry — fall back to the default country.
      return {};
    }
  }

  persist(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(
      STORAGE_SELECTED_LOCATION,
      JSON.stringify({
        label: this.label(),
        province: this.province(),
        city: this.city(),
        area: this.area(),
      }),
    );
  }

  /** Joins a parent and child name the way the stored label expects. */
  buildLabel(parent: string | undefined, child: string): string {
    return parent ? `${parent}, ${child}` : child;
  }

  reset(): void {
    this.province.set(null);
    this.city.set(null);
    this.area.set(null);
    this.label.set(DEFAULT_COUNTRY);
  }
}
