import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { API } from '../../../core/constants/api-endpoints';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';

interface Province {
  _id: string;
  name: string;
}
interface City {
  _id: string;
  name: string;
  provinceId: string;
}
interface Area {
  _id: string;
  name: string;
  cityId: string;
  subareas: string[];
  blockPhases: string[];
}
interface Stats {
  provinces: number;
  cities: number;
  areas: number;
}

const ERR_ADD_PROVINCE = 'Failed to add province';
const ERR_ADD_CITY = 'Failed to add city';
const ERR_ADD_AREA = 'Failed to add area';
const ERR_RENAME = 'Failed to rename';
const ERR_DELETE = 'Failed to delete';
const ERR_UPDATE_AREA = 'Failed to update area';

@Component({
  selector: 'app-location-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-manager.component.html',
  styleUrls: ['./location-manager.component.scss'],
})
export class LocationManagerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly loading = signal(false);
  readonly stats = signal<Stats>({ provinces: 0, cities: 0, areas: 0 });

  readonly provinces = signal<Province[]>([]);
  readonly cities = signal<City[]>([]);
  readonly areas = signal<Area[]>([]);

  readonly selectedProvince = signal<Province | null>(null);
  readonly selectedCity = signal<City | null>(null);
  readonly selectedArea = signal<Area | null>(null);

  provinceSearch = signal('');
  citySearch = signal('');
  areaSearch = signal('');

  editingId = signal<string | null>(null);
  editingName = '';

  newProvinceName = '';
  newCityName = '';
  newAreaName = '';
  showAddProvince = false;
  showAddCity = false;
  showAddArea = false;

  newSubarea = '';
  newBlockPhase = '';
  savingArea = signal(false);
  actionError = signal<string | null>(null);

  readonly filteredProvinces = computed(() => {
    const q = this.provinceSearch().toLowerCase();
    return q ? this.provinces().filter((p) => p.name.toLowerCase().includes(q)) : this.provinces();
  });

  readonly filteredCities = computed(() => {
    const q = this.citySearch().toLowerCase();
    return q ? this.cities().filter((c) => c.name.toLowerCase().includes(q)) : this.cities();
  });

  readonly filteredAreas = computed(() => {
    const q = this.areaSearch().toLowerCase();
    return q ? this.areas().filter((a) => a.name.toLowerCase().includes(q)) : this.areas();
  });

  constructor(
    private readonly api: ApiService,
    private readonly confirm: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadProvinces();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStats(): void {
    this.api
      .get<Stats>('/location/stats')
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => this.stats.set(s));
  }

  loadProvinces(): void {
    this.loading.set(true);
    this.api
      .get<Province[]>(API.LOCATION_PROVINCES)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.provinces.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selectProvince(p: Province): void {
    this.selectedProvince.set(p);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.citySearch.set('');
    this.areaSearch.set('');
    this.api
      .get<City[]>(API.LOCATION_CITIES(p._id))
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => this.cities.set(data));
  }

  selectCity(c: City): void {
    this.selectedCity.set(c);
    this.selectedArea.set(null);
    this.areas.set([]);
    this.areaSearch.set('');
    this.api
      .get<Area[]>(API.LOCATION_AREAS(c._id))
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => this.areas.set(data));
  }

  selectArea(a: Area): void {
    this.selectedArea.set(a);
  }

  addProvince(): void {
    if (!this.newProvinceName.trim()) return;
    this.actionError.set(null);
    this.api
      .post<Province>(API.LOCATION_PROVINCES, { name: this.newProvinceName.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => {
          this.provinces.update((list) =>
            [...list, p].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.newProvinceName = '';
          this.showAddProvince = false;
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_ADD_PROVINCE),
      });
  }

  addCity(): void {
    const prov = this.selectedProvince();
    if (!this.newCityName.trim() || !prov) return;
    this.actionError.set(null);
    this.api
      .post<City>('/location/cities', { name: this.newCityName.trim(), provinceId: prov._id })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (c) => {
          this.cities.update((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
          this.newCityName = '';
          this.showAddCity = false;
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_ADD_CITY),
      });
  }

  addArea(): void {
    const city = this.selectedCity();
    if (!this.newAreaName.trim() || !city) return;
    this.actionError.set(null);
    this.api
      .post<Area>('/location/areas', { name: this.newAreaName.trim(), cityId: city._id })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (a) => {
          this.areas.update((list) => [...list, a].sort((x, y) => x.name.localeCompare(y.name)));
          this.newAreaName = '';
          this.showAddArea = false;
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_ADD_AREA),
      });
  }

  startEdit(id: string, currentName: string): void {
    this.editingId.set(id);
    this.editingName = currentName;
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName = '';
  }

  saveProvinceName(p: Province): void {
    if (!this.editingName.trim()) return;
    this.api
      .patch<Province>(`/location/provinces/${p._id}`, { name: this.editingName.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.provinces.update((list) => list.map((x) => (x._id === updated._id ? updated : x)));
          if (this.selectedProvince()?._id === updated._id) this.selectedProvince.set(updated);
          this.cancelEdit();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_RENAME),
      });
  }

  saveCityName(c: City): void {
    if (!this.editingName.trim()) return;
    this.api
      .patch<City>(`/location/cities/${c._id}`, { name: this.editingName.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.cities.update((list) => list.map((x) => (x._id === updated._id ? updated : x)));
          if (this.selectedCity()?._id === updated._id) this.selectedCity.set(updated);
          this.cancelEdit();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_RENAME),
      });
  }

  saveAreaName(a: Area): void {
    if (!this.editingName.trim()) return;
    this.api
      .patch<Area>(`/location/areas/${a._id}`, { name: this.editingName.trim() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.areas.update((list) => list.map((x) => (x._id === updated._id ? updated : x)));
          if (this.selectedArea()?._id === updated._id) this.selectedArea.set(updated);
          this.cancelEdit();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_RENAME),
      });
  }

  async deleteProvince(p: Province): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete Province',
      message: `Are you sure you want to delete "${p.name}"? This cannot be undone.`,
      confirmText: 'Delete Province',
      variant: 'danger',
    });
    if (!ok) return;
    this.api
      .delete(`/location/provinces/${p._id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.provinces.update((list) => list.filter((x) => x._id !== p._id));
          if (this.selectedProvince()?._id === p._id) {
            this.selectedProvince.set(null);
            this.cities.set([]);
            this.areas.set([]);
            this.selectedCity.set(null);
            this.selectedArea.set(null);
          }
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_DELETE),
      });
  }

  async deleteCity(c: City): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete City',
      message: `Are you sure you want to delete "${c.name}"?`,
      confirmText: 'Delete City',
      variant: 'danger',
    });
    if (!ok) return;
    this.api
      .delete(`/location/cities/${c._id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cities.update((list) => list.filter((x) => x._id !== c._id));
          if (this.selectedCity()?._id === c._id) {
            this.selectedCity.set(null);
            this.areas.set([]);
            this.selectedArea.set(null);
          }
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_DELETE),
      });
  }

  async deleteArea(a: Area): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete Area',
      message: `Are you sure you want to delete "${a.name}" and all its subareas/blocks?`,
      confirmText: 'Delete Area',
      variant: 'danger',
    });
    if (!ok) return;
    this.api
      .delete(`/location/areas/${a._id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.areas.update((list) => list.filter((x) => x._id !== a._id));
          if (this.selectedArea()?._id === a._id) this.selectedArea.set(null);
          this.loadStats();
        },
        error: (e) => this.actionError.set(e?.error?.message || ERR_DELETE),
      });
  }

  addSubarea(): void {
    const area = this.selectedArea();
    if (!area || !this.newSubarea.trim()) return;
    const updated = [...area.subareas, this.newSubarea.trim()];
    this.saveAreaDetail(area, { subareas: updated });
    this.newSubarea = '';
  }

  removeSubarea(idx: number): void {
    const area = this.selectedArea();
    if (!area) return;
    this.saveAreaDetail(area, { subareas: area.subareas.filter((_, i) => i !== idx) });
  }

  addBlockPhase(): void {
    const area = this.selectedArea();
    if (!area || !this.newBlockPhase.trim()) return;
    const updated = [...area.blockPhases, this.newBlockPhase.trim()];
    this.saveAreaDetail(area, { blockPhases: updated });
    this.newBlockPhase = '';
  }

  removeBlockPhase(idx: number): void {
    const area = this.selectedArea();
    if (!area) return;
    this.saveAreaDetail(area, { blockPhases: area.blockPhases.filter((_, i) => i !== idx) });
  }

  private saveAreaDetail(area: Area, patch: Partial<Area>): void {
    this.savingArea.set(true);
    this.api
      .patch<Area>(`/location/areas/${area._id}`, patch)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.areas.update((list) => list.map((x) => (x._id === updated._id ? updated : x)));
          this.selectedArea.set(updated);
          this.savingArea.set(false);
        },
        error: (e) => {
          this.actionError.set(e?.error?.message || ERR_UPDATE_AREA);
          this.savingArea.set(false);
        },
      });
  }
}
