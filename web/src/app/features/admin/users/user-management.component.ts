import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminUser,
  GetUsersParams,
} from '../../../core/services/admin.service';
import { UserRole, UserStatus } from '../../../core/models/user.model';
import { UserStatus as UserStatusEnum } from '../../../core/constants/enums';
import { ROLE_OPTIONS, ROLE_CHANGE_OPTIONS, STATUS_OPTIONS } from '../../../core/constants/select-options';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { VerificationBadgesComponent } from '../../../shared/components/verification-badges/verification-badges.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, DatePickerComponent, VerificationBadgesComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly totalUsers = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly actionLoading = signal<string | null>(null);

  searchQuery = '';
  roleFilter: UserRole | '' = '';
  statusFilter: UserStatus | '' = '';
  filterDateFrom = '';
  filterDateTo = '';
  filtersOpen = false;

  // Sorting
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly roleOptions: SelectOption[] = ROLE_OPTIONS;
  readonly statusOptions: SelectOption[] = STATUS_OPTIONS;
  readonly roleChangeOptions: SelectOption[] = ROLE_CHANGE_OPTIONS;

  // Permissions management
  permissionsUserId: string | null = null;
  permissionsUserName = '';
  allPermissions: { key: string; value: string; group: string; action: string }[] = [];
  selectedPermissions: Set<string> = new Set();
  permissionGroups: { group: string; permissions: { key: string; value: string; action: string }[] }[] = [];
  savingPermissions = false;

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalUsers() / this.pageSize()))
  );

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  get hasActiveFilters(): boolean {
    return !!(this.roleFilter || this.statusFilter || this.filterDateFrom || this.filterDateTo);
  }

  get activeFilterCount(): number {
    let c = 0;
    if (this.roleFilter) c++;
    if (this.statusFilter) c++;
    if (this.filterDateFrom || this.filterDateTo) c++;
    return c;
  }

  constructor(
    private readonly adminService: AdminService,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    const params: GetUsersParams = {
      page: this.currentPage(),
      limit: this.pageSize(),
    };
    if (this.searchQuery.trim()) params.search = this.searchQuery.trim();
    if (this.roleFilter) params.role = this.roleFilter;
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.filterDateFrom) params.startDate = this.filterDateFrom;
    if (this.filterDateTo) params.endDate = this.filterDateTo;

    this.adminService.getUsers(params).subscribe({
      next: (res: any) => {
        const users = Array.isArray(res) ? res : (res.users ?? res.data ?? []);
        this.users.set(users);
        this.totalUsers.set(res.total ?? users.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load users. Please try again.');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  onSearch(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.roleFilter = '';
    this.statusFilter = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadUsers();
  }

  toggleUserStatus(user: AdminUser): void {
    const newStatus: UserStatus = user.status === UserStatusEnum.ACTIVE ? 'suspended' : 'active';
    this.actionLoading.set(user._id);
    this.adminService.updateUserStatus(user._id, newStatus).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => (u._id === user._id ? { ...u, status: newStatus } : u))
        );
        this.actionLoading.set(null);
      },
      error: () => { this.actionLoading.set(null); },
    });
  }

  changeRole(user: AdminUser, role: UserRole): void {
    if (role === user.role) return;
    this.actionLoading.set(user._id);
    this.adminService.updateUserRole(user._id, role).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => (u._id === user._id ? { ...u, role } : u))
        );
        this.actionLoading.set(null);
      },
      error: () => { this.actionLoading.set(null); },
    });
  }

  updateAdLimit(user: AdminUser, value: string): void {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit < 0 || limit === user.adLimit) return;
    this.actionLoading.set(user._id);
    this.adminService.updateAdLimit(user._id, limit).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => (u._id === user._id ? { ...u, adLimit: limit } : u))
        );
        this.actionLoading.set(null);
      },
      error: () => { this.actionLoading.set(null); },
    });
  }

  getUserName(user: AdminUser): string {
    const name = `${user.profile.firstName} ${user.profile.lastName}`.trim();
    return name || 'Unknown User';
  }

  getUserContact(user: AdminUser): string {
    return user.email || user.phone || '—';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-PK', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  sortUsers(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.users.update(list => [...list].sort((a: any, b: any) => {
      const va = a[col]; const vb = b[col];
      if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
      return ((va ?? 0) - (vb ?? 0)) * dir;
    }));
  }

  sortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  // ── Permissions Management ──────────────────────────────────────

  openPermissions(user: AdminUser): void {
    this.permissionsUserId = user._id;
    this.permissionsUserName = this.getUserName(user);
    this.selectedPermissions = new Set(user.permissions || []);

    if (this.allPermissions.length === 0) {
      this.loadPermissionsList();
    } else {
      this.buildPermissionGroups();
    }
  }

  private loadPermissionsList(): void {
    this.adminService.getPermissionsList().subscribe({
      next: (res) => {
        this.allPermissions = res.permissions || [];
        this.buildPermissionGroups();
      },
      error: () => {
        // Fallback: build from hardcoded list if API fails
        this.allPermissions = [
          { key: 'USERS_VIEW', value: 'users:view', group: 'users', action: 'view' },
          { key: 'USERS_ADD', value: 'users:add', group: 'users', action: 'add' },
          { key: 'USERS_EDIT', value: 'users:edit', group: 'users', action: 'edit' },
          { key: 'USERS_DELETE', value: 'users:delete', group: 'users', action: 'delete' },
          { key: 'USERS_SUSPEND', value: 'users:suspend', group: 'users', action: 'suspend' },
          { key: 'LISTINGS_VIEW', value: 'listings:view', group: 'listings', action: 'view' },
          { key: 'LISTINGS_APPROVE', value: 'listings:approve', group: 'listings', action: 'approve' },
          { key: 'LISTINGS_REJECT', value: 'listings:reject', group: 'listings', action: 'reject' },
          { key: 'LISTINGS_DELETE', value: 'listings:delete', group: 'listings', action: 'delete' },
          { key: 'CATEGORIES_VIEW', value: 'categories:view', group: 'categories', action: 'view' },
          { key: 'CATEGORIES_ADD', value: 'categories:add', group: 'categories', action: 'add' },
          { key: 'CATEGORIES_EDIT', value: 'categories:edit', group: 'categories', action: 'edit' },
          { key: 'CATEGORIES_DELETE', value: 'categories:delete', group: 'categories', action: 'delete' },
          { key: 'LOCATIONS_VIEW', value: 'locations:view', group: 'locations', action: 'view' },
          { key: 'LOCATIONS_ADD', value: 'locations:add', group: 'locations', action: 'add' },
          { key: 'LOCATIONS_EDIT', value: 'locations:edit', group: 'locations', action: 'edit' },
          { key: 'LOCATIONS_DELETE', value: 'locations:delete', group: 'locations', action: 'delete' },
          { key: 'PACKAGES_VIEW', value: 'packages:view', group: 'packages', action: 'view' },
          { key: 'PACKAGES_ADD', value: 'packages:add', group: 'packages', action: 'add' },
          { key: 'PACKAGES_EDIT', value: 'packages:edit', group: 'packages', action: 'edit' },
          { key: 'PAYMENTS_VIEW', value: 'payments:view', group: 'payments', action: 'view' },
          { key: 'ANALYTICS_VIEW', value: 'analytics:view', group: 'analytics', action: 'view' },
          { key: 'ANALYTICS_EXPORT', value: 'analytics:export', group: 'analytics', action: 'export' },
          { key: 'ACTIVITY_VIEW', value: 'activity:view', group: 'activity', action: 'view' },
          { key: 'ROLES_MANAGE', value: 'roles:manage', group: 'roles', action: 'manage' },
        ];
        this.buildPermissionGroups();
      },
    });
  }

  private buildPermissionGroups(): void {
    const groupMap = new Map<string, { key: string; value: string; action: string }[]>();
    for (const p of this.allPermissions) {
      if (!groupMap.has(p.group)) groupMap.set(p.group, []);
      groupMap.get(p.group)!.push({ key: p.key, value: p.value, action: p.action });
    }
    this.permissionGroups = Array.from(groupMap.entries()).map(([group, permissions]) => ({ group, permissions }));
  }

  togglePermission(value: string): void {
    if (this.selectedPermissions.has(value)) {
      this.selectedPermissions.delete(value);
    } else {
      this.selectedPermissions.add(value);
    }
    this.selectedPermissions = new Set(this.selectedPermissions);
  }

  toggleGroupAll(group: string): void {
    const groupPerms = this.allPermissions.filter(p => p.group === group);
    const allSelected = groupPerms.every(p => this.selectedPermissions.has(p.value));
    for (const p of groupPerms) {
      if (allSelected) {
        this.selectedPermissions.delete(p.value);
      } else {
        this.selectedPermissions.add(p.value);
      }
    }
    this.selectedPermissions = new Set(this.selectedPermissions);
  }

  isGroupAllSelected(group: string): boolean {
    const groupPerms = this.allPermissions.filter(p => p.group === group);
    return groupPerms.length > 0 && groupPerms.every(p => this.selectedPermissions.has(p.value));
  }

  savePermissions(): void {
    if (!this.permissionsUserId) return;
    this.savingPermissions = true;
    const perms = Array.from(this.selectedPermissions);
    this.adminService.updatePermissions(this.permissionsUserId, perms).subscribe({
      next: () => {
        this.users.update(list =>
          list.map(u => u._id === this.permissionsUserId ? { ...u, permissions: perms } : u)
        );
        this.savingPermissions = false;
        this.permissionsUserId = null;
      },
      error: () => { this.savingPermissions = false; },
    });
  }

  closePermissions(): void {
    this.permissionsUserId = null;
  }

  formatGroupName(group: string): string {
    return group.charAt(0).toUpperCase() + group.slice(1);
  }

  formatActionName(action: string): string {
    return action.charAt(0).toUpperCase() + action.slice(1);
  }
}
