import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

interface RejectionReason {
  _id: string;
  title: string;
  description?: string;
  isActive: boolean;
}

@Component({
  selector: 'app-rejection-reasons',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './rejection-reasons.component.html',
  styleUrl: './rejection-reasons.component.scss',
})
export class RejectionReasonsComponent implements OnInit {
  readonly loading = signal(true);
  readonly reasons = signal<RejectionReason[]>([]);
  readonly saving = signal(false);

  editingId: string | null = null;
  editTitle = '';
  editDescription = '';

  newTitle = '';
  newDescription = '';
  showAddForm = false;

  deletingId: string | null = null;

  // Search, filter, sort
  searchQuery = '';
  filterStatus = '';
  sortBy = 'default';

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  readonly sortOptions: SelectOption[] = [
    { value: 'default', label: 'Default' },
    { value: 'az', label: 'A → Z' },
    { value: 'za', label: 'Z → A' },
  ];

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadReasons();
  }

  get filteredReasons(): RejectionReason[] {
    let result = this.reasons();

    // Search
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }

    // Status filter
    if (this.filterStatus === 'active') {
      result = result.filter(r => r.isActive);
    } else if (this.filterStatus === 'inactive') {
      result = result.filter(r => !r.isActive);
    }

    // Sort
    if (this.sortBy === 'az') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (this.sortBy === 'za') {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    }

    return result;
  }

  loadReasons(): void {
    this.loading.set(true);
    this.adminService.getRejectionReasons(true).subscribe({
      next: (res) => {
        this.reasons.set(res);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  startAdd(): void {
    this.showAddForm = true;
    this.newTitle = '';
    this.newDescription = '';
  }

  cancelAdd(): void {
    this.showAddForm = false;
  }

  saveNew(): void {
    if (!this.newTitle.trim()) return;
    this.saving.set(true);
    this.adminService.createRejectionReason({ title: this.newTitle.trim(), description: this.newDescription.trim() || undefined }).subscribe({
      next: () => {
        this.showAddForm = false;
        this.saving.set(false);
        this.loadReasons();
      },
      error: () => { this.saving.set(false); },
    });
  }

  startEdit(reason: RejectionReason): void {
    this.editingId = reason._id;
    this.editTitle = reason.title;
    this.editDescription = reason.description || '';
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editTitle.trim()) return;
    this.saving.set(true);
    this.adminService.updateRejectionReason(this.editingId, { title: this.editTitle.trim(), description: this.editDescription.trim() || undefined }).subscribe({
      next: () => {
        this.editingId = null;
        this.saving.set(false);
        this.loadReasons();
      },
      error: () => { this.saving.set(false); },
    });
  }

  toggleActive(reason: RejectionReason): void {
    this.adminService.updateRejectionReason(reason._id, { isActive: !reason.isActive }).subscribe({
      next: () => { this.loadReasons(); },
    });
  }

  deleteReason(reason: RejectionReason): void {
    this.deletingId = reason._id;
  }

  confirmDelete(): void {
    if (!this.deletingId) return;
    this.adminService.deleteRejectionReason(this.deletingId).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadReasons();
      },
    });
  }

  cancelDelete(): void {
    this.deletingId = null;
  }
}
