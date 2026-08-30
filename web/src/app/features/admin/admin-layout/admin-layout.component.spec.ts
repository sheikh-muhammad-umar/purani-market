import { describe, it, expect, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';

/** Only the two members the layout actually reads off the router. */
function routerStub(url = '/admin') {
  const events = new Subject<NavigationEnd>();
  return { stub: { url, events } as unknown as Router, events };
}

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;

  beforeEach(() => {
    component = new AdminLayoutComponent(routerStub().stub);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have navigation items', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    expect(allItems.length).toBeGreaterThan(0);
  });

  it('should include Dashboard nav item', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    const dashboard = allItems.find((n) => n.label === 'Dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.path).toBe('/admin');
  });

  it('should include Users nav item', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    const users = allItems.find((n) => n.label === 'Users');
    expect(users).toBeDefined();
    expect(users!.path).toBe('/admin/users');
  });

  it('should include Listings nav item', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    const listings = allItems.find((n) => n.label === 'Listings');
    expect(listings).toBeDefined();
    expect(listings!.path).toBe('/admin/listings');
  });

  it('should include Categories nav item', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    const categories = allItems.find((n) => n.label === 'Categories');
    expect(categories).toBeDefined();
    expect(categories!.path).toBe('/admin/categories');
  });

  it('should include Packages nav item', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    const packages = allItems.find((n) => n.label === 'Packages');
    expect(packages).toBeDefined();
    expect(packages!.path).toBe('/admin/packages');
  });

  it('should start with sidebar expanded', () => {
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('should toggle sidebar collapsed state', () => {
    expect(component.sidebarCollapsed).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(true);
    component.toggleSidebar();
    expect(component.sidebarCollapsed).toBe(false);
  });

  it('should have icons for all nav items', () => {
    const allItems = component.navSections.flatMap((s) => s.items);
    allItems.forEach((item) => {
      expect(item.icon).toBeTruthy();
    });
  });

  it('should expand the nav group that owns the current URL on load', () => {
    const onAnalytics = new AdminLayoutComponent(routerStub('/admin/analytics/users').stub);
    expect(onAnalytics.expandedNavItem).toBe('/admin/analytics');
  });

  it('should leave every group closed on a URL that has no group', () => {
    expect(component.expandedNavItem).toBeNull();
  });

  it('should expand the owning group when navigation lands on a nested page', () => {
    const { stub, events } = routerStub('/admin');
    const layout = new AdminLayoutComponent(stub);
    expect(layout.expandedNavItem).toBeNull();

    events.next(new NavigationEnd(1, '/admin', '/admin/analytics/revenue'));

    expect(layout.expandedNavItem).toBe('/admin/analytics');
  });

  it('should keep a manually opened group open when navigating outside any group', () => {
    const { stub, events } = routerStub('/admin/analytics/users');
    const layout = new AdminLayoutComponent(stub);
    expect(layout.expandedNavItem).toBe('/admin/analytics');

    events.next(new NavigationEnd(1, '/admin/analytics/users', '/admin/users'));

    // /admin/users belongs to no group, so the previous group is left alone
    // rather than collapsing the sidebar out from under the user.
    expect(layout.expandedNavItem).toBe('/admin/analytics');
  });

  it('should expose the new analytics reports as children of the Analytics group', () => {
    const analytics = component.navSections
      .flatMap((s) => s.items)
      .find((n) => n.label === 'Analytics');
    expect(analytics?.children?.map((c) => c.path)).toEqual([
      '/admin/analytics/listings',
      '/admin/analytics/shorts',
      '/admin/analytics/users',
      '/admin/analytics/revenue',
      '/admin/analytics/traffic',
      '/admin/analytics/funnel',
      '/admin/analytics/behaviour',
    ]);
  });
});
