import {
  Component,
  signal,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { LoginModalComponent } from './shared/components/login-modal/login-modal.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { ROUTES } from './core/constants/routes';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    LoginModalComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  readonly showScrollTop = signal(false);
  readonly hideFooter = signal(false);
  private scrolling = false;
  private navSub?: Subscription;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.hideFooter.set(this.router.url.startsWith(ROUTES.MESSAGING));
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.hideFooter.set(e.urlAfterRedirects.startsWith(ROUTES.MESSAGING)));
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.scrolling && this.isBrowser) {
      this.showScrollTop.set(window.scrollY > 400);
    }
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    this.scrolling = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      this.scrolling = false;
      this.showScrollTop.set(false);
    }, 600);
  }
}
