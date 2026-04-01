import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: '📊', path: '/admin' },
    { label: 'Users', icon: '👥', path: '/admin/users' },
    { label: 'Listings', icon: '📋', path: '/admin/listings' },
    { label: 'Categories', icon: '🏷️', path: '/admin/categories' },
    { label: 'Packages', icon: '📦', path: '/admin/packages' },
    { label: 'Payments', icon: '💳', path: '/admin/payments' },
  ];

  sidebarCollapsed = false;
  mobileMenuOpen = false;

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }
}
