import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROUTES } from '../../../core/constants/routes';
import { NavItem } from './admin-layout.interfaces';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent {
  readonly ROUTES = ROUTES;

  readonly exactMatchOptions = { exact: true };
  readonly prefixMatchOptions = { exact: false };

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', path: ROUTES.ADMIN },
    { label: 'Users', icon: 'group', path: ROUTES.ADMIN_USERS },
    { label: 'Listings', icon: 'list_alt', path: ROUTES.ADMIN_LISTINGS },
    { label: 'Shorts', icon: 'play_circle', path: ROUTES.ADMIN_SHORTS },
    { label: 'Shorts Analytics', icon: 'analytics', path: ROUTES.ADMIN_SHORTS_ANALYTICS },
    { label: 'Moderation', icon: 'gavel', path: ROUTES.ADMIN_MODERATION },
    { label: 'ID Verifications', icon: 'verified_user', path: ROUTES.ADMIN_ID_VERIFICATIONS },
    { label: 'Activity', icon: 'timeline', path: ROUTES.ADMIN_ACTIVITY },
    { label: 'Payments', icon: 'payments', path: ROUTES.ADMIN_PAYMENTS },
    { label: 'Packages', icon: 'inventory_2', path: ROUTES.ADMIN_PACKAGES },
    { label: 'Notifications', icon: 'notifications', path: ROUTES.ADMIN_NOTIFICATIONS },
    { label: 'Categories', icon: 'category', path: ROUTES.ADMIN_CATEGORIES },
    { label: 'Locations', icon: 'location_on', path: ROUTES.ADMIN_LOCATIONS },
    { label: 'Brands', icon: 'branding_watermark', path: ROUTES.ADMIN_BRANDS },
    { label: 'Vehicles', icon: 'directions_car', path: ROUTES.ADMIN_VEHICLES },
    { label: 'Deletion Reasons', icon: 'delete_sweep', path: ROUTES.ADMIN_DELETION_REASONS },
    { label: 'Rejection Reasons', icon: 'rule', path: ROUTES.ADMIN_REJECTION_REASONS },
    { label: 'Experiments', icon: 'science', path: ROUTES.ADMIN_EXPERIMENTS },
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
