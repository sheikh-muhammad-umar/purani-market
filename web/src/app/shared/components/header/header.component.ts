import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  HostListener,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { LoginModalService } from '../login-modal/login-modal.service';
import { AppBannerComponent } from '../app-banner/app-banner.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { NotificationCountService } from '../../../core/services/notification-count.service';
import { VoiceSearchComponent } from '../voice-search/voice-search.component';
import { Province, City, Area } from '../../../core/models';
import { STORAGE_SELECTED_LOCATION } from '../../../core/constants/storage-keys';
import { DEFAULT_COUNTRY } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import {
  MOBILE_BREAKPOINT,
  SEARCH_PLACEHOLDER_MOBILE,
  SEARCH_PLACEHOLDER_DESKTOP,
  SEARCH_BLUR_DELAY,
  LOGOUT_DELAY,
  SCROLL_THRESHOLD,
} from './header.constants';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, AppBannerComponent, NotificationBellComponent, VoiceSearchComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  accountMenuOpen = signal(false);
  unreadCount = signal(0);
  scrolled = signal(false);
  readonly defaultCountry = DEFAULT_COUNTRY;
  readonly ROUTES = ROUTES;
  private subs: Subscription[] = [];
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Location selector state
  locationDropdownOpen = signal(false);
  searchDropdownOpen = signal(false);
  searchQuery = signal('');
  searchPlaceholder = signal(
    this.isBrowser && window.innerWidth < MOBILE_BREAKPOINT
      ? SEARCH_PLACEHOLDER_MOBILE
      : SEARCH_PLACEHOLDER_DESKTOP,
  );
  provinces = signal<Province[]>([]);
  cities = signal<City[]>([]);
  areas = signal<Area[]>([]);
  selectedProvince = signal<Province | null>(null);
  selectedCity = signal<City | null>(null);
  selectedArea = signal<Area | null>(null);
  locationLabel = signal(DEFAULT_COUNTRY);
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

  private searchBlurTimeout: ReturnType<typeof setTimeout> | null = null;
  private logoutTimeout: ReturnType<typeof setTimeout> | null = null;

  // Page detection — computed from router URL to avoid recalculating every CD cycle
  private currentUrl = signal('');
  readonly isAuthPage = computed(() => this.currentUrl().startsWith(ROUTES.AUTH));
  readonly isMessagingPage = computed(() => this.currentUrl().startsWith(ROUTES.MESSAGING));
  readonly isChatOpen = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return url !== ROUTES.MESSAGING && url.startsWith(ROUTES.MESSAGING + '/');
  });
  readonly isProfilePage = computed(() => this.currentUrl().startsWith(ROUTES.PROFILE));
  readonly isAdminPage = computed(() => this.currentUrl().startsWith(ROUTES.ADMIN));

  /** Combined computed for header scroll class and mobile search visibility */
  readonly showScrolledHeader = computed(
    () =>
      this.scrolled() &&
      !this.isAuthPage() &&
      !this.isMessagingPage() &&
      !this.isProfilePage() &&
      !this.isAdminPage(),
  );
  readonly showMobileSearch = computed(
    () =>
      !this.isAuthPage() && !this.isMessagingPage() && !this.isProfilePage() && !this.isAdminPage(),
  );
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  readonly isAdmin = computed(() => this.authService.isAdmin());

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
    public readonly notificationCount: NotificationCountService,
  ) {}

  ngOnInit(): void {
    if (this.authService.getAccessToken() && !this.authService.user()) {
      this.authService.fetchCurrentUser().subscribe();
    }

    this.loadProvinces();
    this.restoreLocationFromStorage();

    // Track current URL for page detection signals
    this.currentUrl.set(this.router.url);
    this.subs.push(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.currentUrl.set(e.urlAfterRedirects);
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
    if (this.searchBlurTimeout) clearTimeout(this.searchBlurTimeout);
    if (this.logoutTimeout) clearTimeout(this.logoutTimeout);
  }

  private refreshUnreadCount(): void {
    if (!this.authService.isAuthenticated()) return;
    this.messagingService.getUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.count),
      error: () => {},
    });
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
      this.router.navigate([ROUTES.SEARCH], { queryParams: { q } });
    }
  }

  onVoiceSearchResult(transcript: string, inputEl: HTMLInputElement): void {
    inputEl.value = transcript;
    this.goToSearch(transcript);
  }

  clearSearch(inputEl: HTMLInputElement): void {
    inputEl.value = '';
    this.searchQuery.set('');
    inputEl.focus();
  }

  onSearchFocus(): void {
    if (this.recentSearches.searches().length > 0) {
      this.searchDropdownOpen.set(true);
    }
  }

  onSearchBlur(): void {
    this.searchBlurTimeout = setTimeout(
      () => this.searchDropdownOpen.set(false),
      SEARCH_BLUR_DELAY,
    );
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
    if (!this.isBrowser) return;
    this.searchPlaceholder.set(
      window.innerWidth < MOBILE_BREAKPOINT
        ? SEARCH_PLACEHOLDER_MOBILE
        : SEARCH_PLACEHOLDER_DESKTOP,
    );
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.scrolled.set(window.scrollY > SCROLL_THRESHOLD);
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
    this.applyLocation(this.buildLabel(this.selectedArea()?.name, name));
  }

  /** "All Pakistan" */
  seeAllPakistan(): void {
    this.selectedProvince.set(null);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.applyLocation(DEFAULT_COUNTRY);
  }

  /** "All <Province>" */
  seeAllInProvince(): void {
    const p = this.selectedProvince();
    if (!p) return;
    this.applyLocation(p.name);
  }

  /** "All <City>" */
  seeAllInCity(): void {
    const c = this.selectedCity();
    if (!c) return;
    this.applyLocation(this.buildLabel(this.selectedProvince()?.name, c.name));
  }

  /** "All <Area>" */
  seeAllInArea(): void {
    const a = this.selectedArea();
    if (!a) return;
    this.applyLocation(this.buildLabel(this.selectedCity()?.name, a.name));
  }

  private applyLocation(fullLabel: string): void {
    const previousLocation = this.locationLabel();
    this.locationLabel.set(fullLabel);
    this.locationDropdownOpen.set(false);
    this.saveLocationToStorage();
    this.tracker.track(TrackingEvent.LOCATION_CHANGE, {
      metadata: { previousLocation, newLocation: fullLabel },
    });
    this.reloadCurrentPage();
  }

  goBackToProvinces(): void {
    this.selectedProvince.set(null);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
    this.locationLabel.set(DEFAULT_COUNTRY);
    this.locationSearch.set('');
  }

  goBackToCities(): void {
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.areas.set([]);
    this.locationLabel.set(this.selectedProvince()?.name ?? DEFAULT_COUNTRY);
    this.locationSearch.set('');
  }

  goBackToAreas(): void {
    this.selectedArea.set(null);
    this.locationLabel.set(this.selectedCity()?.name ?? DEFAULT_COUNTRY);
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
    localStorage.setItem(STORAGE_SELECTED_LOCATION, JSON.stringify(state));
  }

  private reloadCurrentPage(): void {
    const url = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(url);
    });
  }

  private restoreLocationFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_LOCATION);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.label) this.locationLabel.set(state.label);
      if (state.province) this.selectedProvince.set(state.province);
      if (state.city) this.selectedCity.set(state.city);
      if (state.area) this.selectedArea.set(state.area);

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
    this.closeAccountMenu();
    this.tracker.track(TrackingEvent.LOGOUT, { metadata: this.tracker.getDeviceInfo() });
    this.logoutTimeout = setTimeout(() => {
      this.wsService.disconnect();
      this.notificationCount.setCount(0);
      this.notificationCount.stop();
      this.unreadCount.set(0);
      this.authService.logout();
      this.loggingOut = false;
    }, LOGOUT_DELAY);
  }
}
