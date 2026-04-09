import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LocationService } from '../../../core/services/location.service';
import { RecentSearchesService } from '../../../core/services/recent-searches.service';
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
  provinces = signal<Province[]>([]);
  cities = signal<City[]>([]);
  areas = signal<Area[]>([]);
  selectedProvince = signal<Province | null>(null);
  selectedCity = signal<City | null>(null);
  selectedArea = signal<Area | null>(null);
  locationLabel = signal('Pakistan');

  constructor(
    public readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    public readonly themeService: ThemeService,
    private readonly router: Router,
    public readonly loginModal: LoginModalService,
    private readonly locationService: LocationService,
    public readonly recentSearches: RecentSearchesService,
  ) {}

  ngOnInit(): void {
    if (this.authService.getAccessToken() && !this.authService.user()) {
      this.authService.fetchCurrentUser().subscribe();
    }

    this.refreshUnreadCount();
    this.loadProvinces();

    this.subs.push(
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      ).subscribe(() => {
        this.refreshUnreadCount();
        this.closeAccountMenu();
      })
    );

    const userId = this.authService.user()?._id;
    if (userId) {
      this.wsService.connect(userId);
    }
    this.subs.push(
      this.wsService.on('newMessage').subscribe(() => this.refreshUnreadCount())
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
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

  toggleMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update(open => !open);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-location') && !target.closest('.location-dropdown') &&
        !target.closest('.mobile-location-btn') && !target.closest('.mobile-location-dropdown')) {
      this.locationDropdownOpen.set(false);
    }
    if (!target.closest('.header-search') && !target.closest('.mobile-search-wrap')) {
      this.searchDropdownOpen.set(false);
    }
  }

  toggleLocationDropdown(): void {
    this.locationDropdownOpen.update(open => !open);
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
    this.locationService.getCities(province._id).subscribe({
      next: (cities) => {
        if (cities.length === 0) {
          // No cities — select province and reset drill-down so reopening shows provinces
          this.locationLabel.set(province.name);
          this.locationDropdownOpen.set(false);
          this.selectedProvince.set(null);
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
    this.locationService.getAreas(city._id).subscribe({
      next: (areas) => {
        if (areas.length === 0) {
          // No areas — select city and reset to cities level so reopening shows cities
          this.locationLabel.set(this.buildLabel(this.selectedProvince()?.name, city.name));
          this.locationDropdownOpen.set(false);
          this.selectedCity.set(null);
        } else {
          this.areas.set(areas);
        }
      },
      error: () => {},
    });
  }

  selectArea(area: Area): void {
    if (area.subareas.length === 0 && area.blockPhases.length === 0) {
      // No deeper level — select area and reset to areas level so reopening shows areas
      this.locationLabel.set(this.buildLabel(this.selectedCity()?.name, area.name));
      this.locationDropdownOpen.set(false);
      this.selectedArea.set(null);
    } else {
      this.selectedArea.set(area);
    }
  }

  selectSubItem(name: string): void {
    this.applyLocation(name, this.buildLabel(this.selectedArea()?.name, name));
  }

  /** "All Pakistan" */
  seeAllPakistan(): void {
    this.applyLocation('Pakistan', 'Pakistan');
    this.selectedProvince.set(null);
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.cities.set([]);
    this.areas.set([]);
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
    this.locationLabel.set(fullLabel);
    this.locationDropdownOpen.set(false);
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
  }

  goBackToCities(): void {
    this.selectedCity.set(null);
    this.selectedArea.set(null);
    this.areas.set([]);
    this.locationLabel.set(this.selectedProvince()?.name ?? 'Pakistan');
  }

  goBackToAreas(): void {
    this.selectedArea.set(null);
    this.locationLabel.set(this.selectedCity()?.name ?? 'Pakistan');
  }

  private buildLabel(parent: string | undefined, child: string): string {
    return parent ? `${parent}, ${child}` : child;
  }

  logout(): void {
    this.closeMenu();
    this.closeAccountMenu();
    this.authService.logout();
  }
}
