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
    { label: 'Dashboard', icon: 'dashboard', path: '/admin' },
    { label: 'Users', icon: 'group', path: '/admin/users' },
    { label: 'Listings', icon: 'list_alt', path: '/admin/listings' },
    { label: 'Moderation', icon: 'gavel', path: '/admin/moderation' },
    { label: 'Categories', icon: 'category', path: '/admin/categories' },
    { label: 'Packages', icon: 'inventory_2', path: '/admin/packages' },
    { label: 'Payments', icon: 'payments', path: '/admin/payments' },
    { label: 'Locations', icon: 'location_on', path: '/admin/locations' },
    { label: 'Activity', icon: 'timeline', path: '/admin/activity' },
    { label: 'Rejection Reasons', icon: 'rule', path: '/admin/rejection-reasons' },
    { label: 'Deletion Reasons', icon: 'delete_sweep', path: '/admin/deletion-reasons' },
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
