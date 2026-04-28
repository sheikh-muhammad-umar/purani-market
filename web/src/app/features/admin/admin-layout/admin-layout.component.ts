import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROUTES } from '../../../core/constants/routes';

interface NavItem {
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
  readonly ROUTES = ROUTES;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', path: ROUTES.ADMIN },
    { label: 'Users', icon: 'group', path: `${ROUTES.ADMIN}/users` },
    { label: 'Listings', icon: 'list_alt', path: `${ROUTES.ADMIN}/listings` },
    { label: 'Moderation', icon: 'gavel', path: `${ROUTES.ADMIN}/moderation` },
    { label: 'Categories', icon: 'category', path: `${ROUTES.ADMIN}/categories` },
    { label: 'Brands', icon: 'branding_watermark', path: `${ROUTES.ADMIN}/brands` },
    { label: 'Vehicles', icon: 'directions_car', path: `${ROUTES.ADMIN}/vehicles` },
    { label: 'Packages', icon: 'inventory_2', path: `${ROUTES.ADMIN}/packages` },
    { label: 'Payments', icon: 'payments', path: `${ROUTES.ADMIN}/payments` },
    { label: 'Locations', icon: 'location_on', path: `${ROUTES.ADMIN}/locations` },
    { label: 'Activity', icon: 'timeline', path: `${ROUTES.ADMIN}/activity` },
    { label: 'Rejection Reasons', icon: 'rule', path: `${ROUTES.ADMIN}/rejection-reasons` },
    { label: 'Deletion Reasons', icon: 'delete_sweep', path: `${ROUTES.ADMIN}/deletion-reasons` },
    { label: 'ID Verifications', icon: 'verified_user', path: `${ROUTES.ADMIN}/id-verifications` },
    { label: 'Notifications', icon: 'notifications', path: `${ROUTES.ADMIN}/notifications` },
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
