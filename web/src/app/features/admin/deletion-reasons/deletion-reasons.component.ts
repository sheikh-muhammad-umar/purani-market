import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

interface DeletionReason {
  _id: string;
  title: string;
  description?: string;
  isActive: boolean;
}

@Component({
  selector: 'app-deletion-reasons',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './deletion-reasons.component.html',
  styleUrl: './deletion-reasons.component.scss',
})
export class DeletionReasonsComponent implements OnInit {
  readonly loading = signal(true);
  readonly reasons = signal<DeletionReason[]>([]);
  readonly saving = signal(false);

  editingId: string | null = null;
  editTitle = '';
  editDescription = '';
  newTitle = '';
  newDescription = '';
  showAddForm = false;
  deletingId: string | null = null;

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

  ngOnInit(): void { this.loadReasons(); }

  get filteredReasons(): DeletionReason[] {
    let result = this.reasons();
    const q = this.searchQuery.toLowerCase().trim();
    if (q) result = result.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    if (this.filterStatus === 'active') result = result.filter(r => r.isActive);
    else if (this.filterStatus === 'inactive') result = result.filter(r => !r.isActive);
    if (this.sortBy === 'az') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    else if (this.sortBy === 'za') result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }

  loadReasons(): void {
    this.loading.set(true);
    this.adminService.getDeletionReasons(true).subscribe({
      next: (res) => { this.reasons.set(res); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  startAdd(): void { this.showAddForm = true; this.newTitle = ''; this.newDescription = ''; }
  cancelAdd(): void { this.showAddForm = false; }

  saveNew(): void {
    if (!this.newTitle.trim()) return;
    this.saving.set(true);
    this.adminService.createDeletionReason({ title: this.newTitle.trim(), description: this.newDescription.trim() || undefined }).subscribe({
      next: () => { this.showAddForm = false; this.saving.set(false); this.loadReasons(); },
      error: () => { this.saving.set(false); },
    });
  }

  startEdit(reason: DeletionReason): void { this.editingId = reason._id; this.editTitle = reason.title; this.editDescription = reason.description || ''; }
  cancelEdit(): void { this.editingId = null; }

  saveEdit(): void {
    if (!this.editingId || !this.editTitle.trim()) return;
    this.saving.set(true);
    this.adminService.updateDeletionReason(this.editingId, { title: this.editTitle.trim(), description: this.editDescription.trim() || undefined }).subscribe({
      next: () => { this.editingId = null; this.saving.set(false); this.loadReasons(); },
      error: () => { this.saving.set(false); },
    });
  }

  toggleActive(reason: DeletionReason): void {
    this.adminService.updateDeletionReason(reason._id, { isActive: !reason.isActive }).subscribe({ next: () => { this.loadReasons(); } });
  }

  deleteReason(reason: DeletionReason): void { this.deletingId = reason._id; }
  confirmDelete(): void {
    if (!this.deletingId) return;
    this.adminService.deleteDeletionReason(this.deletingId).subscribe({ next: () => { this.deletingId = null; this.loadReasons(); } });
  }
  cancelDelete(): void { this.deletingId = null; }
}
