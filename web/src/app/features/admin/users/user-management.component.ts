import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminUser,
  GetUsersParams,
} from '../../../core/services/admin.service';
import { UserRole, UserStatus } from '../../../core/models/user.model';
import { UserRole as UserRoleEnum, UserStatus as UserStatusEnum } from '../../../core/constants/enums';
import { ROLE_OPTIONS, ROLE_CHANGE_OPTIONS, STATUS_OPTIONS } from '../../../core/constants/select-options';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
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

  // Sorting
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly roleOptions: SelectOption[] = ROLE_OPTIONS;

  readonly statusOptions: SelectOption[] = STATUS_OPTIONS;

  readonly roleChangeOptions: SelectOption[] = ROLE_CHANGE_OPTIONS;

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalUsers() / this.pageSize()))
  );

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  constructor(private readonly adminService: AdminService) {}

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
      error: () => {
        this.actionLoading.set(null);
      },
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
      error: () => {
        this.actionLoading.set(null);
      },
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
      error: () => {
        this.actionLoading.set(null);
      },
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
}
