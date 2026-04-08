import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LoginModalService } from '../login-modal/login-modal.service';

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

  constructor(
    public readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    public readonly themeService: ThemeService,
    private readonly router: Router,
    public readonly loginModal: LoginModalService,
  ) {}

  ngOnInit(): void {
    if (this.authService.getAccessToken() && !this.authService.user()) {
      this.authService.fetchCurrentUser().subscribe();
    }

    this.refreshUnreadCount();

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
      this.router.navigate(['/search'], { queryParams: { q } });
    }
  }

  logout(): void {
    this.closeMenu();
    this.closeAccountMenu();
    this.authService.logout();
  }
}
