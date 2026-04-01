import { describe, it, expect, beforeEach } from 'vitest';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;

  beforeEach(() => {
    component = new AdminLayoutComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have navigation items', () => {
    expect(component.navItems.length).toBeGreaterThan(0);
  });

  it('should include Dashboard nav item', () => {
    const dashboard = component.navItems.find(n => n.label === 'Dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.path).toBe('/admin');
  });

  it('should include Users nav item', () => {
    const users = component.navItems.find(n => n.label === 'Users');
    expect(users).toBeDefined();
    expect(users!.path).toBe('/admin/users');
  });

  it('should include Listings nav item', () => {
    const listings = component.navItems.find(n => n.label === 'Listings');
    expect(listings).toBeDefined();
    expect(listings!.path).toBe('/admin/listings');
  });

  it('should include Categories nav item', () => {
    const categories = component.navItems.find(n => n.label === 'Categories');
    expect(categories).toBeDefined();
    expect(categories!.path).toBe('/admin/categories');
  });

  it('should include Packages nav item', () => {
    const packages = component.navItems.find(n => n.label === 'Packages');
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
    component.navItems.forEach(item => {
      expect(item.icon).toBeTruthy();
    });
  });
});
