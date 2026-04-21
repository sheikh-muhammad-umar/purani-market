import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LocationService } from '../../../core/services/location.service';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { LoginModalService } from '../login-modal/login-modal.service';
import { Province, City, Area } from '../../../core/models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  mobileMenuOpen = signal(false);
  accountMenuOpen = signal(false);
  unreadCount = signal(0);
  private subs: Subscription[] = [];

  // Location selector state
  locationDropdownOpen = signal(false);
  searchDropdownOpen = signal(false);
  searchPlaceholder = signal(
    window.innerWidth < 1024 ? 'Search...' : 'Find cars, phones, furniture...',
  );
  provinces = signal<Province[]>([]);
  cities = signal<City[]>([]);
  areas = signal<Area[]>([]);
  selectedProvince = signal<Province | null>(null);
  selectedCity = signal<City | null>(null);
  selectedArea = signal<Area | null>(null);
  locationLabel = signal('Pakistan');
  locationSearch = signal('');

  filteredProvinces = computed(() => {
    const q = this.locationSearch().toLowerCase().trim();
    return q ? this.provinces().filter((p) => p.name.toLowerCase().includes(q)) : this.provinces();
  });
  filteredCities = computed(() => {
    const q = this.locationSearch().toLowerCase().trim();
    return q ? this.cities().filter((c) => c.name.toLowerCase().includes(q)) : this.cities();
  });
  filteredAreas = computed(() => {
    const q = this.locationSearch().toLowerCase().trim();
    return q ? this.areas().filter((a) => a.name.toLowerCase().includes(q)) : this.areas();
  });

  constructor(
    public readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    public readonly themeService: ThemeService,
    private readonly router: Router,
    public readonly loginModal: LoginModalService,
    private readonly locationService: LocationService,
    public readonly recentSearches: RecentSearchesService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    if (this.authService.getAccessToken() && !this.authService.user()) {
      this.authService.fetchCurrentUser().subscribe();
    }

    this.loadProvinces();
    this.restoreLocationFromStorage();

    this.subs.push(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => {
          this.refreshUnreadCount();
          this.closeAccountMenu();
        }),
    );

    const userId = this.authService.user()?._id;
    if (userId) {
      this.wsService.connect(userId);
    }
    this.subs.push(this.wsService.on('newMessage').subscribe(() => this.refreshUnreadCount()));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private refreshUnreadCount(): void {
    if (!this.authService.isAuthenticated()) return;
    this.messagingService.getUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.count),
      error: () => {},
    });
  }

  get isAuthPage(): boolean {
    return this.router.url.startsWith('/auth/');
  }

  get isMessagingPage(): boolean {
    return this.router.url.startsWith('/messaging');
  }

  get isProfilePage(): boolean {
    return this.router.url.startsWith('/profile');
  }

  get isAdminPage(): boolean {
    return this.router.url.startsWith('/admin');
  }

  toggleMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  goToSearch(query: string): void {
    const q = query?.trim();
    if (q) {
      this.recentSearches.add(q);
      this.searchDropdownOpen.set(false);
      this.router.navigate(['/search'], { queryParams: { q } });
    }
  }

  onSearchFocus(): void {
    if (this.recentSearches.searches().length > 0) {
      this.searchDropdownOpen.set(true);
    }
  }

  onSearchBlur(): void {
    // Delay to allow click on suggestion
    setTimeout(() => this.searchDropdownOpen.set(false), 200);
  }

  selectRecentSearch(term: string, inputEl: HTMLInputElement): void {
    inputEl.value = term;
    this.goToSearch(term);
  }

  removeRecentSearch(term: string, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.recentSearches.remove(term);
    if (this.recentSearches.searches().length === 0) {
      this.searchDropdownOpen.set(false);
    }
  }

  clearRecentSearches(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.recentSearches.clear();
    this.searchDropdownOpen.set(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.searchPlaceholder.set(
      window.innerWidth < 1024 ? 'Search...' : 'Find cars, phones, furniture...',
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest('.search-location') &&
      !target.closest('.location-dropdown') &&
      !target.closest('.mobile-location-btn') &&
      !target.closest('.mobile-location-dropdown')
    ) {
      this.locationDropdownOpen.set(false);
    }
    if (!target.closest('.header-search') && !target.closest('.mobile-search-wrap')) {
      this.searchDropdownOpen.set(false);
    }
  }

  toggleLocationDropdown(): void {
    this.locationDropdownOpen.update((open) => !open);
    if (!this.locationDropdownOpen()) {
      this.locationSearch.set('');
    }
  }

  private loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces) => this.provinces.set(provinces),
      error: () => {},
    });
  }

  selectProvince(province: Province): void {
    this.selectedProvince.set(province);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.locationSearch.set('');
    this.locationService.getCities(province._id).subscribe({
      next: (cities) => {
        if (cities.length === 0) {
          this.locationLabel.set(province.name);
          this.locationDropdownOpen.set(false);
          this.saveLocationToStorage();
          this.reloadCurrentPage();
        } else {
          this.cities.set(cities);
        }
      },
      error: () => {},
    });
  }

  selectCity(city: City): void {
    this.selectedCity.set(city);
    this.selectedArea.set(null);
    this.areas.set([]);
    this.locationSearch.set('');
    this.locationService.getAreas(city._id).subscribe({
      next: (areas) => {
        if (areas.length === 0) {
          this.locationLabel.set(this.buildLabel(this.selectedProvince()?.name, city.name));
          this.locationDropdownOpen.set(false);
          this.saveLocationToStorage();
          this.reloadCurrentPage();
        } else {
          this.areas.set(areas);
        }
      },
      error: () => {},
    });
  }

  selectArea(area: Area): void {
    if (area.subareas.length === 0 && area.blockPhases.length === 0) {
      this.locationLabel.set(this.buildLabel(this.selectedCity()?.name, area.name));
      this.locationDropdownOpen.set(false);
      this.selectedArea.set(area);
      this.saveLocationToStorage();
      this.reloadCurrentPage();
    } else {
      this.selectedArea.set(area);
    }
  }

  selectSubItem(name: string): void {
    this.applyLocation(name, this.buildLabel(this.selectedArea()?.name, name));
  }

  /** "All Pakistan" */
  seeAllPakistan(): void {
    this.selectedProvince.set(null);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.applyLocation('Pakistan', 'Pakistan');
  }

  /** "All <Province>" */
  seeAllInProvince(): void {
    const p = this.selectedProvince();
    if (!p) return;
    this.applyLocation(p.name, p.name);
  }

  /** "All <City>" */
  seeAllInCity(): void {
    const c = this.selectedCity();
    if (!c) return;
    this.applyLocation(c.name, this.buildLabel(this.selectedProvince()?.name, c.name));
  }

  /** "All <Area>" */
  seeAllInArea(): void {
    const a = this.selectedArea();
    if (!a) return;
    this.applyLocation(a.name, this.buildLabel(this.selectedCity()?.name, a.name));
  }

  private applyLocation(label: string, fullLabel: string): void {
    const previousLocation = this.locationLabel();
    this.locationLabel.set(fullLabel);
    this.locationDropdownOpen.set(false);
    this.saveLocationToStorage();
    this.tracker.track('location_change', {
      metadata: { previousLocation, newLocation: fullLabel },
    });
    this.reloadCurrentPage();
  }

  clearLocation(): void {
    this.seeAllPakistan();
  }

  goBackToProvinces(): void {
    this.selectedProvince.set(null);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.locationLabel.set('Pakistan');
    this.locationSearch.set('');
  }

  goBackToCities(): void {
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.areas.set([]);
    this.locationLabel.set(this.selectedProvince()?.name ?? 'Pakistan');
    this.locationSearch.set('');
  }

  goBackToAreas(): void {
    this.selectedArea.set(null);
    this.locationLabel.set(this.selectedCity()?.name ?? 'Pakistan');
    this.locationSearch.set('');
  }

  private buildLabel(parent: string | undefined, child: string): string {
    return parent ? `${parent}, ${child}` : child;
  }

  private saveLocationToStorage(): void {
    const state = {
      label: this.locationLabel(),
      province: this.selectedProvince(),
      city: this.selectedCity(),
      area: this.selectedArea(),
    };
    localStorage.setItem('selected_location', JSON.stringify(state));
  }

  private reloadCurrentPage(): void {
    // Use Angular router to re-navigate to the same URL, forcing components to re-init
    const url = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(url);
    });
  }

  private restoreLocationFromStorage(): void {
    try {
      const raw = localStorage.getItem('selected_location');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.label) this.locationLabel.set(state.label);
      if (state.province) this.selectedProvince.set(state.province);
      if (state.city) this.selectedCity.set(state.city);
      if (state.area) this.selectedArea.set(state.area);

      // Reload child data so dropdowns work if reopened
      if (state.province?._id) {
        this.locationService.getCities(state.province._id).subscribe({
          next: (cities) => this.cities.set(cities),
          error: () => {},
        });
      }
      if (state.city?._id) {
        this.locationService.getAreas(state.city._id).subscribe({
          next: (areas) => this.areas.set(areas),
          error: () => {},
        });
      }
    } catch {
      // corrupted data — ignore
    }
  }

  private loggingOut = false;

  logout(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.closeMenu();
    this.closeAccountMenu();
    this.recentSearches.searches();
    this.tracker.track('logout', { metadata: this.tracker.getDeviceInfo() });
    // Small delay to let the track request fire before tokens are cleared
    setTimeout(() => {
      this.authService.logout();
      this.loggingOut = false;
    }, 150);
  }
}
