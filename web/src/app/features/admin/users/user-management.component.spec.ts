import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { UserManagementComponent } from './user-management.component';
import { AdminService, AdminUser, UsersResponse } from '../../../core/services/admin.service';

const mockUsers: AdminUser[] = [
  {
    _id: 'u1',
    email: 'alice@example.com',
    role: 'seller',
    status: 'active',
    profile: { firstName: 'Alice', lastName: 'Smith', avatar: '' },
    adLimit: 10,
    activeAdCount: 3,
    createdAt: '2024-01-15T00:00:00Z',
    lastLoginAt: '2024-06-01T00:00:00Z',
    listingsCount: 5,
    conversationsCount: 12,
    violationsCount: 0,
  },
  {
    _id: 'u2',
    phone: '+923001234567',
    role: 'buyer',
    status: 'suspended',
    profile: { firstName: 'Bob', lastName: '', avatar: '' },
    adLimit: 10,
    activeAdCount: 0,
    createdAt: '2024-03-20T00:00:00Z',
    listingsCount: 0,
    conversationsCount: 2,
    violationsCount: 1,
  },
];

const mockResponse: UsersResponse = {
  users: mockUsers,
  total: 25,
  page: 1,
  limit: 10,
};

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let adminService: {
    getUsers: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
    updateUserRole: ReturnType<typeof vi.fn>;
    updateAdLimit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    adminService = {
      getUsers: vi.fn().mockReturnValue(of(mockResponse)),
      updateUserStatus: vi.fn().mockReturnValue(of(undefined)),
      updateUserRole: vi.fn().mockReturnValue(of(undefined)),
      updateAdLimit: vi.fn().mockReturnValue(of(undefined)),
    };
    component = new UserManagementComponent(adminService as unknown as AdminService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', () => {
    component.ngOnInit();
    expect(adminService.getUsers).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.users().length).toBe(2);
    expect(component.totalUsers()).toBe(25);
  });

  it('should handle load error', () => {
    adminService.getUsers.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load users. Please try again.');
  });

  it('should compute total pages', () => {
    component.ngOnInit();
    expect(component.totalPages()).toBe(3); // 25 / 10 = 2.5 → ceil = 3
  });

  it('should compute page numbers around current page', () => {
    component.ngOnInit();
    component.currentPage.set(2);
    const pages = component.pages();
    expect(pages).toContain(1);
    expect(pages).toContain(2);
    expect(pages).toContain(3);
  });

  it('should pass search query as param', () => {
    component.searchQuery = 'alice';
    component.onSearch();
    expect(adminService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alice', page: 1 })
    );
  });

  it('should pass role filter as param', () => {
    component.roleFilter = 'seller';
    component.applyFilters();
    expect(adminService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'seller' })
    );
  });

  it('should pass status filter as param', () => {
    component.statusFilter = 'suspended';
    component.applyFilters();
    expect(adminService.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended' })
    );
  });

  it('should reset to page 1 on filter change', () => {
    component.ngOnInit();
    component.currentPage.set(3);
    component.roleFilter = 'buyer';
    component.applyFilters();
    expect(component.currentPage()).toBe(1);
  });

  it('should navigate to a valid page', () => {
    component.ngOnInit();
    adminService.getUsers.mockClear();
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    expect(adminService.getUsers).toHaveBeenCalled();
  });

  it('should not navigate to invalid page', () => {
    component.ngOnInit();
    adminService.getUsers.mockClear();
    component.goToPage(0);
    expect(adminService.getUsers).not.toHaveBeenCalled();
    component.goToPage(100);
    expect(adminService.getUsers).not.toHaveBeenCalled();
  });

  it('should toggle user status from active to suspended', () => {
    component.ngOnInit();
    const user = component.users()[0]; // active
    component.toggleUserStatus(user);
    expect(adminService.updateUserStatus).toHaveBeenCalledWith('u1', 'suspended');
    expect(component.users()[0].status).toBe('suspended');
  });

  it('should toggle user status from suspended to active', () => {
    component.ngOnInit();
    const user = component.users()[1]; // suspended
    component.toggleUserStatus(user);
    expect(adminService.updateUserStatus).toHaveBeenCalledWith('u2', 'active');
    expect(component.users()[1].status).toBe('active');
  });

  it('should handle toggle status error', () => {
    adminService.updateUserStatus.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    const user = component.users()[0];
    component.toggleUserStatus(user);
    expect(component.actionLoading()).toBeNull();
    expect(component.users()[0].status).toBe('active'); // unchanged
  });

  it('should change user role', () => {
    component.ngOnInit();
    const user = component.users()[0]; // seller
    component.changeRole(user, 'admin');
    expect(adminService.updateUserRole).toHaveBeenCalledWith('u1', 'admin');
    expect(component.users()[0].role).toBe('admin');
  });

  it('should not change role if same', () => {
    component.ngOnInit();
    const user = component.users()[0];
    component.changeRole(user, 'seller');
    expect(adminService.updateUserRole).not.toHaveBeenCalled();
  });

  it('should handle change role error', () => {
    adminService.updateUserRole.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    const user = component.users()[0];
    component.changeRole(user, 'admin');
    expect(component.actionLoading()).toBeNull();
    expect(component.users()[0].role).toBe('seller'); // unchanged
  });

  it('should update ad limit', () => {
    component.ngOnInit();
    const user = component.users()[0]; // adLimit: 10
    component.updateAdLimit(user, '20');
    expect(adminService.updateAdLimit).toHaveBeenCalledWith('u1', 20);
    expect(component.users()[0].adLimit).toBe(20);
  });

  it('should not update ad limit for invalid input', () => {
    component.ngOnInit();
    const user = component.users()[0];
    component.updateAdLimit(user, 'abc');
    expect(adminService.updateAdLimit).not.toHaveBeenCalled();
  });

  it('should not update ad limit for negative value', () => {
    component.ngOnInit();
    const user = component.users()[0];
    component.updateAdLimit(user, '-5');
    expect(adminService.updateAdLimit).not.toHaveBeenCalled();
  });

  it('should not update ad limit if same value', () => {
    component.ngOnInit();
    const user = component.users()[0];
    component.updateAdLimit(user, '10');
    expect(adminService.updateAdLimit).not.toHaveBeenCalled();
  });

  it('should handle ad limit update error', () => {
    adminService.updateAdLimit.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    const user = component.users()[0];
    component.updateAdLimit(user, '20');
    expect(component.actionLoading()).toBeNull();
    expect(component.users()[0].adLimit).toBe(10); // unchanged
  });

  it('should get user display name', () => {
    component.ngOnInit();
    expect(component.getUserName(component.users()[0])).toBe('Alice Smith');
    expect(component.getUserName(component.users()[1])).toBe('Bob');
  });

  it('should return Unknown User for empty name', () => {
    const user: AdminUser = {
      ...mockUsers[0],
      profile: { firstName: '', lastName: '', avatar: '' },
    };
    expect(component.getUserName(user)).toBe('Unknown User');
  });

  it('should get user contact info', () => {
    component.ngOnInit();
    expect(component.getUserContact(component.users()[0])).toBe('alice@example.com');
    expect(component.getUserContact(component.users()[1])).toBe('+923001234567');
  });

  it('should return dash for user with no contact', () => {
    const user: AdminUser = { ...mockUsers[0], email: undefined, phone: undefined };
    expect(component.getUserContact(user)).toBe('—');
  });

  it('should format date string', () => {
    const result = component.formatDate('2024-01-15T00:00:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });

  it('should return dash for missing date', () => {
    expect(component.formatDate(undefined)).toBe('—');
  });
});
