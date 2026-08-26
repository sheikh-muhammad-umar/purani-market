import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { LocationService } from '../../../core/services/location.service';
import { SelectedLocationService } from '../../../core/services/selected-location.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { Area, City, Province } from '../../../core/models';
import { DEFAULT_COUNTRY } from '../../../core/constants/app';

/** One drill-down step. Each level filters the list below it. */
type Level = 'province' | 'city' | 'area' | 'sub';

/**
 * Province → city → area → subarea location picker.
 *
 * Previously this markup existed twice in the header template — once for the
 * desktop search bar and once for the mobile search row — around 220 duplicated
 * lines that had to be edited in lockstep. Selection state lives in
 * `SelectedLocationService` so both placements stay in sync.
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  templateUrl: './location-picker.component.html',
  styleUrls: ['./location-picker.component.scss'],
})
export class LocationPickerComponent implements OnInit {
  private readonly locationService = inject(LocationService);
  private readonly tracker = inject(ActivityTrackerService);
  protected readonly selected = inject(SelectedLocationService);

  /** `compact` is the mobile search row; `bar` sits inside the desktop search bar. */
  readonly variant = input<'bar' | 'compact'>('bar');

  /** Emitted after a location is applied, so the host can refresh the page data. */
  readonly changed = output<void>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly provinces = signal<Province[]>([]);
  protected readonly cities = signal<City[]>([]);
  protected readonly areas = signal<Area[]>([]);
  protected readonly defaultCountry = DEFAULT_COUNTRY;

  /** Unique id so the trigger's aria-controls stays valid with two instances. */
  protected readonly panelId = `lp-${Math.random().toString(36).slice(2, 9)}`;

  protected readonly label = this.selected.label;
  protected readonly province = this.selected.province;
  protected readonly city = this.selected.city;
  protected readonly area = this.selected.area;

  /** Which list the panel is currently showing. */
  protected readonly level = computed<Level>(() => {
    if (this.area()) return 'sub';
    if (this.city()) return 'area';
    if (this.province()) return 'city';
    return 'province';
  });

  /** Name of the level the user has drilled into, for the back button. */
  protected readonly currentName = computed(
    () => this.area()?.name ?? this.city()?.name ?? this.province()?.name ?? '',
  );

  /** Label for the "show everything at this level" shortcut. */
  protected readonly allLabel = computed(() => this.currentName() || this.defaultCountry);

  private readonly matches = (name: string) => {
    const q = this.query().toLowerCase().trim();
    return !q || name.toLowerCase().includes(q);
  };

  protected readonly visibleProvinces = computed(() =>
    this.provinces().filter((p) => this.matches(p.name)),
  );
  protected readonly visibleCities = computed(() =>
    this.cities().filter((c) => this.matches(c.name)),
  );
  protected readonly visibleAreas = computed(() =>
    this.areas().filter((a) => this.matches(a.name)),
  );

  ngOnInit(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces) => this.provinces.set(provinces),
      error: () => {},
    });

    // Re-fetch the lists for whatever the previous session had drilled into, so
    // reopening the panel lands the user where they left off.
    const { provinceId, cityId } = this.selected.restore();
    if (provinceId) {
      this.locationService.getCities(provinceId).subscribe({
        next: (cities) => this.cities.set(cities),
        error: () => {},
      });
    }
    if (cityId) {
      this.locationService.getAreas(cityId).subscribe({
        next: (areas) => this.areas.set(areas),
        error: () => {},
      });
    }
  }

  protected toggle(): void {
    this.open.update((o) => !o);
    if (!this.open()) this.query.set('');
  }

  protected close(): void {
    this.open.set(false);
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('app-location-picker')) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Drills into a province, or applies it when it has no cities. */
  protected selectProvince(province: Province): void {
    this.selected.province.set(province);
    this.selected.city.set(null);
    this.selected.area.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.query.set('');
    this.locationService.getCities(province._id).subscribe({
      next: (cities) => {
        if (cities.length) this.cities.set(cities);
        else this.apply(province.name);
      },
      error: () => {},
    });
  }

  protected selectCity(city: City): void {
    this.selected.city.set(city);
    this.selected.area.set(null);
    this.areas.set([]);
    this.query.set('');
    this.locationService.getAreas(city._id).subscribe({
      next: (areas) => {
        if (areas.length) this.areas.set(areas);
        else this.apply(this.selected.buildLabel(this.province()?.name, city.name));
      },
      error: () => {},
    });
  }

  protected selectArea(area: Area): void {
    this.selected.area.set(area);
    this.query.set('');
    if (!area.subareas.length && !area.blockPhases.length) {
      this.apply(this.selected.buildLabel(this.city()?.name, area.name));
    }
  }

  protected selectSubItem(name: string): void {
    this.apply(this.selected.buildLabel(this.area()?.name, name));
  }

  /** Applies the broadest option available at the current level. */
  protected selectAllAtLevel(): void {
    switch (this.level()) {
      case 'province':
        this.selected.reset();
        this.cities.set([]);
        this.areas.set([]);
        this.apply(this.defaultCountry);
        break;
      case 'city':
        this.apply(this.province()!.name);
        break;
      case 'area':
        this.apply(this.selected.buildLabel(this.province()?.name, this.city()!.name));
        break;
      case 'sub':
        this.apply(this.selected.buildLabel(this.city()?.name, this.area()!.name));
        break;
    }
  }

  /** Steps back one level without applying anything. */
  protected goBack(): void {
    this.query.set('');
    if (this.area()) {
      this.selected.area.set(null);
      this.selected.label.set(this.city()?.name ?? this.defaultCountry);
      return;
    }
    if (this.city()) {
      this.selected.city.set(null);
      this.selected.area.set(null);
      this.areas.set([]);
      this.selected.label.set(this.province()?.name ?? this.defaultCountry);
      return;
    }
    this.selected.reset();
    this.cities.set([]);
    this.areas.set([]);
  }

  private apply(label: string): void {
    const previousLocation = this.selected.label();
    this.selected.label.set(label);
    this.close();
    this.selected.persist();
    this.tracker.track(TrackingEvent.LOCATION_CHANGE, {
      metadata: { previousLocation, newLocation: label },
    });
    this.changed.emit();
  }
}
