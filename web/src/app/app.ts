import { Component, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { LoginModalComponent } from './shared/components/login-modal/login-modal.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';
import { AppBannerComponent } from './shared/components/app-banner/app-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    LoginModalComponent,
    ConfirmModalComponent,
    AppBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  title = 'marketplace-web';
  showScrollTop = signal(false);
  private scrolling = false;

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.scrolling) {
      this.showScrollTop.set(window.scrollY > 400);
    }
  }

  scrollToTop(): void {
    this.scrolling = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      this.scrolling = false;
      this.showScrollTop.set(false);
    }, 600);
  }
}
