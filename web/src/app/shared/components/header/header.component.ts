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
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LoginModalService } from '../login-modal/login-modal.service';
import { AppBannerComponent } from '../app-banner/app-banner.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { NotificationCountService } from '../../../core/services/notification-count.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { LocationPickerComponent } from '../location-picker/location-picker.component';
import { HeaderSearchComponent } from '../header-search/header-search.component';
import { ROUTES } from '../../../core/constants/routes';
import { LOGOUT_DELAY, SCROLL_THRESHOLD } from './header.constants';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    AppBannerComponent,
    NotificationBellComponent,
    LocationPickerComponent,
    HeaderSearchComponent,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  accountMenuOpen = signal(false);
  unreadCount = signal(0);
  scrolled = signal(false);
  readonly ROUTES = ROUTES;
  private subs: Subscription[] = [];
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Page detection — computed from the router URL so it is not recalculated on
  // every change-detection cycle.
  private currentUrl = signal('');
  readonly isAuthPage = computed(() => this.currentUrl().startsWith(ROUTES.AUTH));
  readonly isMessagingPage = computed(() => this.currentUrl().startsWith(ROUTES.MESSAGING));
  readonly isChatOpen = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return url !== ROUTES.MESSAGING && url.startsWith(ROUTES.MESSAGING + '/');
  });
  readonly isProfilePage = computed(() => this.currentUrl().startsWith(ROUTES.PROFILE));
  readonly isAdminPage = computed(() => this.currentUrl().startsWith(ROUTES.ADMIN));
  readonly isShortsPage = computed(() => this.currentUrl().startsWith(ROUTES.SHORTS));

  /** Pages that own their own chrome and should not get the search row. */
  private readonly isChromelessPage = computed(
    () => this.isAuthPage() || this.isMessagingPage() || this.isProfilePage() || this.isAdminPage(),
  );

  readonly showScrolledHeader = computed(() => this.scrolled() && !this.isChromelessPage());
  readonly showSearch = computed(() => !this.isChromelessPage() && !this.isShortsPage());
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());
  readonly isAdmin = computed(() => this.authService.isAdmin());

  constructor(
    public readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    public readonly themeService: ThemeService,
    private readonly router: Router,
    public readonly loginModal: LoginModalService,
    public readonly notificationCount: NotificationCountService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    // Track the current URL for the page-detection signals (safe on the server).
    this.currentUrl.set(this.router.url);
    this.subs.push(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.currentUrl.set(e.urlAfterRedirects);
          this.closeAccountMenu();
        }),
    );

    // Everything below needs browser APIs (localStorage, WebSocket).
    if (!this.isBrowser) return;

    if (this.authService.getAccessToken() && !this.authService.user()) {
      this.authService.fetchCurrentUser().subscribe();
    }

    const userId = this.authService.user()?._id;
    if (userId) {
      this.wsService.connect(userId);
    }
    this.subs.push(this.wsService.on('newMessage').subscribe(() => this.refreshUnreadCount()));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
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

  /** Formats a badge count, capping it so it cannot widen the icon. */
  badgeCount(count: number, cap = 99): string {
    return count > cap ? `${cap}+` : `${count}`;
  }

  /** Follows a link only when signed in, otherwise prompts for login. */
  requireAuth(event: MouseEvent, target: string): void {
    if (this.isAuthenticated()) return;
    event.preventDefault();
    this.loginModal.open(target);
  }

  /**
   * Re-navigates to the current URL so page data refetches under the new
   * location. Angular skips navigation to an unchanged URL, hence the bounce
   * through `/` with `skipLocationChange` so the address bar is untouched.
   */
  onLocationChanged(): void {
    const url = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigateByUrl(url);
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    this.scrolled.set(window.scrollY > SCROLL_THRESHOLD);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.account-menu')) {
      this.accountMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
  }

  private logoutTimeout: ReturnType<typeof setTimeout> | null = null;
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
