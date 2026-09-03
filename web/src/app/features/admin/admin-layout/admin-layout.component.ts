import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ROUTES } from '../../../core/constants/routes';
import { NavItem, NavSection } from './admin-layout.interfaces';

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

  readonly navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', icon: 'dashboard', path: ROUTES.ADMIN },
        { label: 'Users', icon: 'group', path: ROUTES.ADMIN_USERS },
        { label: 'Listings', icon: 'list_alt', path: ROUTES.ADMIN_LISTINGS },
        { label: 'Shorts', icon: 'play_circle', path: ROUTES.ADMIN_SHORTS },
        {
          label: 'Analytics',
          icon: 'analytics',
          path: ROUTES.ADMIN_ANALYTICS,
          children: [
            { label: 'Listings', icon: 'list_alt', path: ROUTES.ADMIN_ANALYTICS_LISTINGS },
            { label: 'Shorts', icon: 'play_circle', path: ROUTES.ADMIN_ANALYTICS_SHORTS },
            { label: 'Users', icon: 'group', path: ROUTES.ADMIN_ANALYTICS_USERS },
            { label: 'Revenue', icon: 'payments', path: ROUTES.ADMIN_ANALYTICS_REVENUE },
            { label: 'Traffic', icon: 'travel_explore', path: ROUTES.ADMIN_ANALYTICS_TRAFFIC },
            { label: 'Funnel', icon: 'filter_alt', path: ROUTES.ADMIN_ANALYTICS_FUNNEL },
            {
              label: 'Behaviour',
              icon: 'ads_click',
              path: ROUTES.ADMIN_ANALYTICS_BEHAVIOUR,
            },
          ],
        },
      ],
    },
    {
      title: 'Management',
      items: [
        { label: 'ID Verifications', icon: 'verified_user', path: ROUTES.ADMIN_ID_VERIFICATIONS },
        { label: 'Reports', icon: 'flag', path: ROUTES.ADMIN_REPORTS },
        { label: 'Reviews', icon: 'reviews', path: ROUTES.ADMIN_REVIEWS },
        { label: 'Activity', icon: 'timeline', path: ROUTES.ADMIN_ACTIVITY },
        { label: 'Payments', icon: 'payments', path: ROUTES.ADMIN_PAYMENTS },
        {
          label: 'Packages',
          icon: 'inventory_2',
          path: ROUTES.ADMIN_PACKAGES,
          children: [
            { label: 'Listings', icon: 'list_alt', path: ROUTES.ADMIN_PACKAGES_LISTINGS },
            { label: 'Shorts', icon: 'play_circle', path: ROUTES.ADMIN_PACKAGES_SHORTS },
            { label: 'Purchases', icon: 'receipt_long', path: ROUTES.ADMIN_PACKAGES_PURCHASES },
          ],
        },
        {
          label: 'Advertising',
          icon: 'campaign',
          path: ROUTES.ADMIN_ADVERTISING,
          children: [
            {
              label: 'Campaigns',
              icon: 'ads_click',
              path: ROUTES.ADMIN_ADVERTISING_CAMPAIGNS,
            },
            {
              label: 'Advertisers',
              icon: 'storefront',
              path: ROUTES.ADMIN_ADVERTISING_ADVERTISERS,
            },
            {
              label: 'Performance',
              icon: 'trending_up',
              path: ROUTES.ADMIN_ADVERTISING_PERFORMANCE,
            },
          ],
        },
        { label: 'Notifications', icon: 'notifications', path: ROUTES.ADMIN_NOTIFICATIONS },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'Categories', icon: 'category', path: ROUTES.ADMIN_CATEGORIES },
        { label: 'Locations', icon: 'location_on', path: ROUTES.ADMIN_LOCATIONS },
        { label: 'Brands', icon: 'branding_watermark', path: ROUTES.ADMIN_BRANDS },
        { label: 'Vehicles', icon: 'directions_car', path: ROUTES.ADMIN_VEHICLES },
        { label: 'Deletion Reasons', icon: 'delete_sweep', path: ROUTES.ADMIN_DELETION_REASONS },
        { label: 'Rejection Reasons', icon: 'rule', path: ROUTES.ADMIN_REJECTION_REASONS },
        { label: 'Experiments', icon: 'science', path: ROUTES.ADMIN_EXPERIMENTS },
      ],
    },
  ];

  expandedNavItem: string | null = null;
  sidebarCollapsed = false;
  mobileMenuOpen = false;

  constructor(private readonly router: Router) {
    // Child links are only in the DOM while their group is expanded, so a
    // collapsed group hides both the sub-pages and any sign of where you are.
    // Open the group that owns the current URL, on load and on every
    // navigation, so a nested page is always reachable and self-locating.
    this.expandedNavItem = this.groupForUrl(router.url);
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const group = this.groupForUrl(e.urlAfterRedirects);
      if (group) this.expandedNavItem = group;
    });
  }

  /** The parent path of whichever nav group contains this URL, if any. */
  private groupForUrl(url: string): string | null {
    for (const section of this.navSections) {
      for (const item of section.items) {
        if (item.children && url.startsWith(item.path)) return item.path;
      }
    }
    return null;
  }

  toggleNavDropdown(path: string): void {
    this.expandedNavItem = this.expandedNavItem === path ? null : path;
  }

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
